// Remove ES module import for supabase. Use window.supabase instead.

// Step navigation logic for new booking form

// Add this function at the very top-level scope so it is accessible everywhere
function calculateTherapistFee(dateVal, timeVal, durationVal) {
  if (!dateVal || !timeVal || !durationVal) return null;
  
  const dayOfWeek = new Date(dateVal).getDay();
  const hour = parseInt(timeVal.split(':')[0], 10);
  
  // Determine if afterhours/weekend
  let isAfterhours = false;
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    isAfterhours = true;
  } else {
    if (window.businessOpeningHour !== undefined && window.businessClosingHour !== undefined) {
      if (hour < window.businessOpeningHour || hour >= window.businessClosingHour) {
        isAfterhours = true;
      }
    }
  }
  
  // Get appropriate hourly rate
  const hourlyRate = isAfterhours ? window.therapistAfterhoursRate : window.therapistDaytimeRate;
  if (!hourlyRate) return null;
  
  // Calculate base fee: hourly rate (this is the base fee, not multiplied by duration)
  let fee = hourlyRate;
  
  // Apply duration uplift percentage if available
  const duration = window.durationsCache.find(d => d.duration_minutes === Number(durationVal));
  if (duration && duration.uplift_percentage) {
    const durationUplift = hourlyRate * (Number(duration.uplift_percentage) / 100);
    fee += durationUplift;
  }
  
  return Math.round(fee * 100) / 100;
}

// Global showStep function - accessible from anywhere
function showStep(stepId) {
  const steps = Array.from(document.querySelectorAll('.step'));
  const progressSteps = Array.from(document.querySelectorAll('.progress-step'));

    steps.forEach(step => {
      step.classList.remove('active');
    });
    const current = document.getElementById(stepId);
    if (current) current.classList.add('active');

    // Update progress bar
    const idx = steps.findIndex(s => s.id === stepId);
    progressSteps.forEach((ps, i) => {
      if (i === idx) {
        ps.classList.add('active');
      } else {
        ps.classList.remove('active');
      }
    });
  }

document.addEventListener('DOMContentLoaded', function () {
  const steps = Array.from(document.querySelectorAll('.step'));
  const progressSteps = Array.from(document.querySelectorAll('.progress-step'));

  // Disable past dates on the date picker and clear any default value
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-11
  const dd = String(today.getDate()).padStart(2, '0');
  const dateInput = document.getElementById('date');
  dateInput.setAttribute('min', `${yyyy}-${mm}-${dd}`);
  dateInput.value = ''; // Clear any default value

  // Initial state: show only the first step
  showStep('step1');
  
  // Load all data in parallel for better performance
  console.log('🔄 Loading initial data...');
  
  // Show loading indicator
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'loading-indicator';
  loadingDiv.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.9); z-index: 9999; display: flex; align-items: center; justify-content: center;">
      <div style="text-align: center;">
        <div class="egg-timer" style="font-size: 2rem; margin-bottom: 1rem;">⏳</div>
        <div>Loading booking system...</div>
      </div>
    </div>
  `;
  document.body.appendChild(loadingDiv);
  
  // Add timeout and retry logic for network issues
  const loadDataWithRetry = async (loadFunction, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await loadFunction();
      } catch (error) {
        console.warn(`Attempt ${attempt} failed:`, error.message);
        if (attempt === maxRetries) {
          console.error(`Failed after ${maxRetries} attempts:`, error);
          return null;
        }
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  };
  
  Promise.all([
    loadDataWithRetry(populateTherapyOptions),
    loadDataWithRetry(fetchPricingData),
    loadDataWithRetry(fetchSettings)
  ]).then((results) => {
    console.log('✅ All data loaded successfully');
    
    // Check if any data failed to load
    const failedLoads = results.filter(result => result === null).length;
    if (failedLoads > 0) {
      console.warn(`⚠️ ${failedLoads} data sources failed to load. Application will continue with available data.`);
      
      // Show a user-friendly message
      const warningDiv = document.createElement('div');
      warningDiv.style.cssText = `
        position: fixed; top: 10px; right: 10px; 
        background: #fff3cd; border: 1px solid #ffeaa7; 
        padding: 10px; border-radius: 5px; z-index: 10000;
        max-width: 300px; font-size: 14px;
      `;
      warningDiv.innerHTML = `
        <strong>⚠️ Connection Warning</strong><br>
        Some data couldn't be loaded. Please check your internet connection and refresh the page.
      `;
      document.body.appendChild(warningDiv);
      
      // Remove warning after 10 seconds
      setTimeout(() => {
        if (warningDiv.parentNode) {
          warningDiv.parentNode.removeChild(warningDiv);
        }
      }, 10000);
    }
    
    setupPriceListeners();
    
    // Remove loading indicator
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
  }).catch(error => {
    console.error('❌ Error loading initial data:', error);
    
    // Show error message to user
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: #f8d7da; border: 1px solid #f5c6cb; 
      padding: 20px; border-radius: 5px; z-index: 10000;
      max-width: 400px; text-align: center;
    `;
    errorDiv.innerHTML = `
      <h3>⚠️ Connection Error</h3>
      <p>Unable to connect to the booking system. This might be due to:</p>
      <ul style="text-align: left; margin: 10px 0;">
        <li>Internet connection issues</li>
        <li>Temporary server maintenance</li>
        <li>Network restrictions</li>
      </ul>
      <button onclick="location.reload()" style="background: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
        Try Again
      </button>
    `;
    document.body.appendChild(errorDiv);
    
    // Remove loading indicator
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
  });

  // Next buttons
  document.querySelectorAll('.btn.next').forEach(btn => {
    btn.addEventListener('click', function () {
      const currentStepId = btn.closest('.step').id;
      if (validateStep(currentStepId)) {
        const nextId = btn.getAttribute('data-next');
        if (nextId) showStep(nextId);
      }
    });
  });

  // Prev buttons
  document.querySelectorAll('.btn.prev').forEach(btn => {
    btn.addEventListener('click', function () {
      const prevId = btn.getAttribute('data-prev');
      if (prevId) showStep(prevId);
    });
  });

  // Progress bar navigation
  document.querySelectorAll('.progress-step').forEach((stepEl, idx) => {
    stepEl.style.cursor = 'pointer';
    stepEl.addEventListener('click', function () {
      const targetStep = 'step' + (idx + 1);
      const currentStepIdx = steps.findIndex(s => s.classList.contains('active'));
      if (idx <= currentStepIdx) {
        // Always allow backward navigation
        showStep(targetStep);
      } else {
        // Only allow forward navigation if all previous steps are valid
        let canAdvance = true;
        for (let i = 0; i <= idx - 1; i++) {
          if (!validateStep('step' + (i + 1))) {
            canAdvance = false;
            showStep('step' + (i + 1));
            break;
          }
        }
        if (canAdvance) showStep(targetStep);
      }
    });
  });

  function validateStep(stepId) {
    // Clear previous errors
    const currentStep = document.getElementById(stepId);
    currentStep.querySelectorAll('.error-message').forEach(el => el.remove());

    let isValid = true;
    switch (stepId) {
      case 'step1': // Address
        if (!document.getElementById('address').value) {
          isValid = false;
          showError(document.getElementById('address'), 'Please enter and select an address.');
        }
        const bookingType = document.querySelector('input[name="bookingType"]:checked')?.value;
        if (bookingType === 'Corporate Event/Office' && !document.getElementById('businessName').value) {
          isValid = false;
          showError(document.getElementById('businessName'), 'Please enter the business name.');
        }
        break;
      case 'step2': // Service & Duration
        if (!document.getElementById('service').value) {
          isValid = false;
          showError(document.getElementById('service'), 'Please select a service.');
        }
        if (!document.getElementById('duration').value) {
          isValid = false;
          showError(document.getElementById('duration'), 'Please select a duration.');
        }
        break;
      case 'step4': // Date & Time
        if (!document.getElementById('date').value) {
          isValid = false;
          showError(document.getElementById('date'), 'Please select a date.');
        }
        if (!document.getElementById('time').value) {
          isValid = false;
          showError(document.getElementById('timeSlotsContainer'), 'Please select an available time slot.');
        }
        break;
      case 'step5': // Therapist
        if (!document.querySelector('input[name="therapistId"]:checked')) {
          isValid = false;
          showError(document.getElementById('therapistSelection'), 'Please select a therapist.');
        }
        break;
      case 'step6': // Customer Details
        const firstName = document.getElementById('customerFirstName');
        const lastName = document.getElementById('customerLastName');
        const email = document.getElementById('customerEmail');
        const phone = document.getElementById('customerPhone');
        
        if (!firstName?.value) {
          isValid = false;
          showError(firstName || document.getElementById('customerFirstName'), 'Please enter your first name.');
        }
        if (!lastName?.value) {
          isValid = false;
          showError(lastName || document.getElementById('customerLastName'), 'Please enter your last name.');
        }
        if (!email?.value) {
          isValid = false;
          showError(email || document.getElementById('customerEmail'), 'Please enter your email address.');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
          isValid = false;
          showError(email, 'Please enter a valid email address.');
        }
        if (!phone?.value) {
          isValid = false;
          showError(phone || document.getElementById('customerPhone'), 'Please enter your phone number.');
        }
        break;
    }
    return isValid;
  }

  function showError(inputElement, message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    // Insert after the input element or its parent if it's a container
    const parent = inputElement.parentElement;
    if (parent.classList.contains('form-group') || parent.classList.contains('step-content') || parent.id === 'therapistSelection' || parent.id === 'timeSlotsContainer') {
       inputElement.insertAdjacentElement('afterend', errorDiv);
    } else {
       parent.insertAdjacentElement('afterend', errorDiv);
    }
  }

  // Fetch and populate services and durations from Supabase
  async function populateTherapyOptions() {
    try {
    // Fetch services
    const { data: services, error: serviceError } = await window.supabase
      .from('services')
      .select('id, name, service_base_price, is_active')
      .eq('is_active', true)
      .order('sort_order');
    console.log('Supabase services:', services, 'Error:', serviceError);
      
    const serviceSelect = document.getElementById('service');
    if (serviceSelect) {
      serviceSelect.innerHTML = '<option value="">Select a service...</option>';
        if (services && services.length > 0) {
        services.forEach(service => {
          const opt = document.createElement('option');
          opt.value = service.id;
          opt.textContent = service.name;
          serviceSelect.appendChild(opt);
        });
        } else {
          // Add fallback options if no data loaded
          const fallbackServices = [
            { id: '1', name: 'Relaxation Massage', service_base_price: 80 },
            { id: '2', name: 'Deep Tissue Massage', service_base_price: 90 },
            { id: '3', name: 'Sports Massage', service_base_price: 100 }
          ];
          fallbackServices.forEach(service => {
            const opt = document.createElement('option');
            opt.value = service.id;
            opt.textContent = service.name;
            serviceSelect.appendChild(opt);
          });
          console.warn('⚠️ Using fallback services due to connection issues');
        }
      }
      
    // Fetch durations
    const { data: durations, error: durationError } = await window.supabase
      .from('duration_pricing')
      .select('id, duration_minutes, uplift_percentage, is_active')
      .eq('is_active', true)
      .order('sort_order');
    console.log('Supabase durations:', durations, 'Error:', durationError);
      
    const durationSelect = document.getElementById('duration');
    if (durationSelect) {
      durationSelect.innerHTML = '<option value="">Select duration...</option>';
        if (durations && durations.length > 0) {
        durations.forEach(duration => {
          const opt = document.createElement('option');
          opt.value = duration.duration_minutes;
            opt.textContent = `${duration.duration_minutes} minutes`;
          durationSelect.appendChild(opt);
        });
        } else {
          // Add fallback options if no data loaded
          const fallbackDurations = [
            { id: '1', duration_minutes: 30 },
            { id: '2', duration_minutes: 60 },
            { id: '3', duration_minutes: 90 }
          ];
          fallbackDurations.forEach(duration => {
            const opt = document.createElement('option');
            opt.value = duration.duration_minutes;
            opt.textContent = `${duration.duration_minutes} minutes`;
            durationSelect.appendChild(opt);
          });
          console.warn('⚠️ Using fallback durations due to connection issues');
        }
      }
    } catch (error) {
      console.error('❌ Error populating therapy options:', error);
      // Add basic fallback options
      const serviceSelect = document.getElementById('service');
      const durationSelect = document.getElementById('duration');
      
      if (serviceSelect) {
        serviceSelect.innerHTML = `
          <option value="">Select a service...</option>
          <option value="1">Relaxation Massage</option>
          <option value="2">Deep Tissue Massage</option>
          <option value="3">Sports Massage</option>
        `;
      }
      
      if (durationSelect) {
        durationSelect.innerHTML = `
          <option value="">Select duration...</option>
          <option value="30">30 minutes</option>
          <option value="60">60 minutes</option>
          <option value="90">90 minutes</option>
        `;
      }
    }
  }

  window.servicesCache = [];
  window.durationsCache = [];
  window.timePricingRulesCache = [];
  window.businessOpeningHour = undefined;
  window.businessClosingHour = undefined;
  window.beforeServiceBuffer = undefined;
  window.afterServiceBuffer = undefined;
  window.minBookingAdvanceHours = undefined;
  window.therapistDaytimeRate = undefined;
  window.therapistAfterhoursRate = undefined;

console.log('Globals:', {
  businessOpeningHour: window.businessOpeningHour,
  businessClosingHour: window.businessClosingHour,
  beforeServiceBuffer: window.beforeServiceBuffer,
  afterServiceBuffer: window.afterServiceBuffer,
  minBookingAdvanceHours: window.minBookingAdvanceHours
});

  async function fetchPricingData() {
    try {
    // Fetch services
    const { data: services } = await window.supabase
      .from('services')
      .select('id, name, service_base_price, is_active')
      .eq('is_active', true)
      .order('sort_order');
    window.servicesCache = services || [];

    // Fetch durations
    const { data: durations } = await window.supabase
      .from('duration_pricing')
      .select('id, duration_minutes, uplift_percentage, is_active')
      .eq('is_active', true)
      .order('sort_order');
    window.durationsCache = durations || [];

    // Fetch time pricing rules
    const { data: timeRules } = await window.supabase
      .from('time_pricing_rules')
      .select('id, day_of_week, start_time, end_time, uplift_percentage, is_active, label')
      .eq('is_active', true)
      .order('sort_order');
    window.timePricingRulesCache = timeRules || [];
    } catch (error) {
      console.error('❌ Error fetching pricing data:', error);
      // Use fallback data
      window.servicesCache = [
        { id: '1', name: 'Relaxation Massage', service_base_price: 80 },
        { id: '2', name: 'Deep Tissue Massage', service_base_price: 90 },
        { id: '3', name: 'Sports Massage', service_base_price: 100 }
      ];
      window.durationsCache = [
        { id: '1', duration_minutes: 30, uplift_percentage: 0 },
        { id: '2', duration_minutes: 60, uplift_percentage: 0 },
        { id: '3', duration_minutes: 90, uplift_percentage: 25 }
      ];
      window.timePricingRulesCache = [];
    }
  }

  async function fetchSettings() {
    try {
    const { data: settings } = await window.supabase
      .from('system_settings')
      .select('key, value');
    if (settings) {
      for (const s of settings) {
        if (s.key === 'business_opening_time') window.businessOpeningHour = Number(s.value);
        if (s.key === 'business_closing_time') window.businessClosingHour = Number(s.value);
        if (s.key === 'before_service_buffer_time') window.beforeServiceBuffer = Number(s.value);
        if (s.key === 'after_service_buffer_time') window.afterServiceBuffer = Number(s.value);
        if (s.key === 'min_booking_advance_hours') window.minBookingAdvanceHours = Number(s.value);
        if (s.key === 'therapist_daytime_hourly_rate') window.therapistDaytimeRate = Number(s.value);
        if (s.key === 'therapist_afterhours_hourly_rate') window.therapistAfterhoursRate = Number(s.value);
      }
      }
    } catch (error) {
      console.error('❌ Error fetching settings:', error);
      // Use fallback settings
      window.businessOpeningHour = 9;
      window.businessClosingHour = 17;
      window.beforeServiceBuffer = 15;
      window.afterServiceBuffer = 15;
      window.minBookingAdvanceHours = 2;
      window.therapistDaytimeRate = 45;
      window.therapistAfterhoursRate = 55;
    }
  }

  function calculatePrice() {
    const serviceId = document.getElementById('service').value;
    const durationVal = document.getElementById('duration').value;
    const dateVal = document.getElementById('date').value;
    const timeVal = document.getElementById('time').value;
    if (!serviceId || !durationVal || !dateVal || !timeVal) return;

    // Get base price
    const service = window.servicesCache.find(s => s.id === serviceId);
    if (!service) return;
    let price = Number(service.service_base_price);
    let breakdown = [`Base Price: $${price.toFixed(2)}`];

    // Get duration uplift
    const duration = window.durationsCache.find(d => d.duration_minutes === Number(durationVal));
    if (duration && duration.uplift_percentage) {
      const durationUplift = price * (Number(duration.uplift_percentage) / 100);
      price += durationUplift;
      breakdown.push(`Duration Uplift (${duration.uplift_percentage}%): +$${durationUplift.toFixed(2)}`);
    }

    // Get day of week and time
    const dayOfWeek = new Date(dateVal).getDay(); // 0=Sunday, 6=Saturday
    // Find matching time pricing rule from table
    let timeUplift = 0;
    for (const rule of window.timePricingRulesCache) {
      if (Number(rule.day_of_week) === dayOfWeek) {
        if (timeVal >= rule.start_time && timeVal < rule.end_time) {
          timeUplift = Number(rule.uplift_percentage);
          break;
        }
      }
    }
    if (timeUplift) {
      const timeUpliftAmount = price * (timeUplift / 100);
      price += timeUpliftAmount;
      breakdown.push(`Time Uplift (${timeUplift}%): +$${timeUpliftAmount.toFixed(2)}`);
    }

    // Update price display with breakdown
    document.getElementById('priceAmount').textContent = price.toFixed(2);
    document.getElementById('priceBreakdown').innerHTML = breakdown.join('<br>');
  }

  // Update price when relevant fields change
  function setupPriceListeners() {
    ['service', 'duration', 'date', 'time'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', calculatePrice);
      }
    });
  }

  // On load, fetch settings, pricing data, and set up listeners
  Promise.all([fetchSettings(), fetchPricingData()]).then(() => {
    populateTherapyOptions();
    setupPriceListeners();
  });

  // Initialize Google Places Autocomplete
  if (window.google && window.google.maps && window.google.maps.places) {
    initAutocomplete();
  } else {
    window.initAutocomplete = initAutocomplete;
    window.addEventListener('load', function () {
      if (window.google && window.google.maps && window.google.maps.places) {
        initAutocomplete();
      } else {
        const statusDiv = document.getElementById('address-autocomplete-status');
        if (statusDiv) statusDiv.textContent = 'Google Maps script failed to load.';
      }
    });
  }

  // Show/hide Business Name field based on Booking Type
  const bookingTypeGroup = document.getElementById('bookingTypeGroup');
  const businessNameGroup = document.getElementById('businessNameGroup');
  function updateBusinessNameVisibility() {
    const selectedType = document.querySelector('input[name="bookingType"]:checked')?.value;
    if (selectedType === 'Corporate Event/Office') {
      businessNameGroup.style.display = 'flex';
    } else {
      businessNameGroup.style.display = 'none';
      document.getElementById('businessName').value = '';
    }
  }
  if (bookingTypeGroup) {
    bookingTypeGroup.querySelectorAll('input[name="bookingType"]').forEach(radio => {
      radio.addEventListener('change', updateBusinessNameVisibility);
    });
    updateBusinessNameVisibility();
  }
});

// Google Places Autocomplete for Address
function initAutocomplete() {
  const addressInput = document.getElementById('address');
  const statusDiv = document.getElementById('address-autocomplete-status');
  if (!addressInput || !window.google || !window.google.maps) {
    if (statusDiv) statusDiv.textContent = 'Google Places Autocomplete failed to load.';
    return;
  }
  // Use a session token for better prediction quality
  const sessionToken = new google.maps.places.AutocompleteSessionToken();
  const autocomplete = new google.maps.places.Autocomplete(addressInput, {
    // types: ['geocode'], // Removed to allow hotels, POIs, etc.
    componentRestrictions: { country: 'au' },
    sessionToken: sessionToken
  });
  autocomplete.addListener('place_changed', function () {
    const place = autocomplete.getPlace();
    if (place && place.geometry) {
      const selected = {
        name: place.name || '',
        address: place.formatted_address || addressInput.value,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng()
      };
      addressInput.value = selected.address;
      addressInput.dataset.lat = selected.lat;
      addressInput.dataset.lng = selected.lng;
      addressInput.dataset.businessName = selected.name;
      if (statusDiv) statusDiv.textContent = 'Address selected!';
      console.log('Selected address:', selected);
      checkTherapistCoverageForAddress();
    }
  });
  if (statusDiv) statusDiv.textContent = '';
}

// Add this function to check therapist geolocation coverage after address selection
async function checkTherapistCoverageForAddress() {
  const addressInput = document.getElementById('address');
  const address = addressInput.value;
  const statusDiv = document.getElementById('address-autocomplete-status');
  if (!address) return;
  // Use Google Maps Geocoding API to get coordinates (if not already set)
  // For this example, assume coordinates are set by autocomplete
  const lat = addressInput.dataset.lat ? Number(addressInput.dataset.lat) : null;
  const lng = addressInput.dataset.lng ? Number(addressInput.dataset.lng) : null;
  if (!lat || !lng) return;
  // Fetch all active therapists with lat/lng and service_radius_km
  let { data, error } = await window.supabase
    .from('therapist_profiles')
    .select('id, latitude, longitude, service_radius_km, is_active')
    .eq('is_active', true);
  if (!data || data.length === 0) {
    statusDiv.textContent = 'Sorry, we don’t have any therapists servicing your area at the moment.';
    disableContinueFromAddress();
    return;
  }
  // Haversine formula
  function getDistanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  const covered = data.some(t => {
    if (t.latitude == null || t.longitude == null || t.service_radius_km == null) return false;
    const dist = getDistanceKm(lat, lng, t.latitude, t.longitude);
    return dist <= t.service_radius_km;
  });
  if (!covered) {
    statusDiv.textContent = 'Sorry, we don’t have any therapists servicing your area at the moment.';
    disableContinueFromAddress();
  } else {
    statusDiv.textContent = '';
    enableContinueFromAddress();
  }
}

function disableContinueFromAddress() {
  const btn = document.querySelector('#step1 .btn.next');
  if (btn) btn.disabled = true;
}
function enableContinueFromAddress() {
  const btn = document.querySelector('#step1 .btn.next');
  if (btn) btn.disabled = false;
}

// Add this function to check therapist gender availability after gender selection
async function checkTherapistGenderAvailability() {
  const genderVal = document.querySelector('input[name="genderPref"]:checked')?.value;
  const addressInput = document.getElementById('address');
  const lat = addressInput.dataset.lat ? Number(addressInput.dataset.lat) : null;
  const lng = addressInput.dataset.lng ? Number(addressInput.dataset.lng) : null;
  const statusDiv = document.getElementById('gender-availability-status');
  if (!genderVal || !lat || !lng) return;
  // Fetch all active therapists with lat/lng, gender, and service_radius_km
  let { data, error } = await window.supabase
    .from('therapist_profiles')
    .select('id, latitude, longitude, service_radius_km, is_active, gender')
    .eq('is_active', true);
  if (!data || data.length === 0) {
    statusDiv.textContent = 'Sorry, we do not have any therapists available.';
    disableContinueFromGender();
    return;
  }
  // Haversine formula
  function getDistanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  // Filter therapists by geolocation
  const coveredTherapists = data.filter(t => {
    if (t.latitude == null || t.longitude == null || t.service_radius_km == null) return false;
    const dist = getDistanceKm(lat, lng, t.latitude, t.longitude);
    return dist <= t.service_radius_km;
  });
  // Filter by gender (if not 'any')
  let genderedTherapists = coveredTherapists;
  if (genderVal !== 'any') genderedTherapists = coveredTherapists.filter(t => t.gender === genderVal);
  if (genderedTherapists.length === 0) {
    if (genderVal === 'male') statusDiv.textContent = 'Sorry, we do not have any male therapists available.';
    else if (genderVal === 'female') statusDiv.textContent = 'Sorry, we do not have any female therapists available.';
    else statusDiv.textContent = 'Sorry, we do not have any therapists available.';
    disableContinueFromGender();
  } else {
    statusDiv.textContent = '';
    enableContinueFromGender();
  }
}

function disableContinueFromGender() {
  const btn = document.querySelector('#step3 .btn.next');
  if (btn) btn.disabled = true;
}
function enableContinueFromGender() {
  const btn = document.querySelector('#step3 .btn.next');
  if (btn) btn.disabled = false;
}

// Add a status div to the gender step if not present
const genderStep = document.getElementById('step3');
if (genderStep && !document.getElementById('gender-availability-status')) {
  const statusDiv = document.createElement('div');
  statusDiv.id = 'gender-availability-status';
  statusDiv.style.color = '#b00';
  statusDiv.style.fontSize = '0.95rem';
  statusDiv.style.marginTop = '0.3rem';
  genderStep.querySelector('.step-content').appendChild(statusDiv);
}
// Listen for gender change
const genderRadios = document.querySelectorAll('input[name="genderPref"]');
genderRadios.forEach(radio => radio.addEventListener('change', checkTherapistGenderAvailability));

// Listen for address change or autocomplete selection
const addressInput = document.getElementById('address');
addressInput.addEventListener('blur', checkTherapistCoverageForAddress);
// If using autocomplete, also set lat/lng as data attributes on addressInput

// Helper: get available time slots for a therapist on a given day
async function getAvailableSlotsForTherapist(therapist, date, durationMinutes) {
  if (
    window.businessOpeningHour === undefined ||
    window.businessClosingHour === undefined ||
    window.beforeServiceBuffer === undefined ||
    window.afterServiceBuffer === undefined ||
    window.minBookingAdvanceHours === undefined
  ) {
    console.warn('Business hours, buffer times, or advance booking hours are not set! Check system_settings and fetchSettings().');
    return [];
  }
  console.log('getAvailableSlotsForTherapist called for therapist:', therapist, 'date:', date, 'duration:', durationMinutes);
  // 1. Get working hours for the day
  const dayOfWeek = new Date(date).getDay();
  const { data: availabilities } = await window.supabase
    .from('therapist_availability')
    .select('start_time, end_time')
    .eq('therapist_id', therapist.id)
    .eq('day_of_week', dayOfWeek);
  if (!availabilities || availabilities.length === 0) return [];
  const { start_time, end_time } = availabilities[0];

  // 2. Get existing bookings for the day
  const { data: bookings } = await window.supabase
    .from('bookings')
    .select('booking_time, service_id')
    .eq('therapist_id', therapist.id)
    .gte('booking_time', date + 'T00:00:00')
    .lt('booking_time', date + 'T23:59:59');

  // 3. Build all possible slots (hourly, businessOpeningHour to businessClosingHour)
  const slots = [];
  for (let hour = window.businessOpeningHour; hour <= window.businessClosingHour; hour++) {
    const slotStart = `${hour.toString().padStart(2, '0')}:00`;
    // Check if slot is within working hours
    if (slotStart < start_time || slotStart >= end_time) continue;
    // Check for overlap with existing bookings (including before/after buffer)
    const slotStartDate = new Date(date + 'T' + slotStart);
    const slotEndDate = new Date(slotStartDate.getTime() + durationMinutes * 60000 + window.afterServiceBuffer * 60000);
    let overlaps = false;
    for (const booking of bookings || []) {
      const bookingStart = new Date(booking.booking_time);
      // Get buffer for this booking's service
      let bookingBufferBefore = window.beforeServiceBuffer;
      let bookingBufferAfter = window.afterServiceBuffer;
      if (booking.service_id && window.servicesCache) {
        const svc = window.servicesCache.find(s => s.id === booking.service_id);
        if (svc && svc.buffer_time) bookingBufferAfter = Number(svc.buffer_time);
      }
      const bookingEnd = new Date(bookingStart.getTime() + durationMinutes * 60000 + bookingBufferAfter * 60000);
      const bookingStartWithBuffer = new Date(bookingStart.getTime() - bookingBufferBefore * 60000);
      if (
        (slotStartDate < bookingEnd && slotEndDate > bookingStartWithBuffer)
      ) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) slots.push(slotStart);
  }
  return slots;
}

// Render time slots as buttons instead of dropdown
function renderTimeSlots(slots, selectedSlot) {
  const container = document.getElementById('timeSlotsContainer');
  if (!container) return;
  container.innerHTML = '';
  if (!slots.length) {
    container.innerHTML = '<div style="color:#b00; font-size:0.95rem; margin-top:0.3rem;">No available slots</div>';
    return;
  }
  slots.forEach(slot => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'time-slot-btn' + (slot === selectedSlot ? ' selected' : '');
    btn.textContent = slot;
    btn.onclick = () => {
      const timeInput = document.getElementById('time');
      timeInput.value = slot;
      // Manually dispatch a 'change' event so that listeners (like calculatePrice and updateTherapistSelection) will fire
      timeInput.dispatchEvent(new Event('change'));

      renderTimeSlots(slots, slot);
      // Therapist selection update is now handled by the 'change' event listener on the #time input
    };
    container.appendChild(btn);
  });
}

// Add a hidden input for time value
if (!document.getElementById('time')) {
  const timeInput = document.createElement('input');
  timeInput.type = 'hidden';
  timeInput.id = 'time';
  document.querySelector('#timeSlotsContainer').parentNode.appendChild(timeInput);
}

// Update updateAvailableTimeSlots to use renderTimeSlots
async function updateAvailableTimeSlots() {
  const container = document.getElementById('timeSlotsContainer');
  const dateVal = document.getElementById('date').value;
  if (container) {
    if (dateVal) {
      container.innerHTML = `<div class="spinner-container"><svg class="egg-timer" width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><g><ellipse cx="20" cy="12" rx="10" ry="6" stroke="#00729B" stroke-width="3"/><ellipse cx="20" cy="28" rx="10" ry="6" stroke="#00729B" stroke-width="3"/><path d="M10 12 Q20 20 30 12" stroke="#00729B" stroke-width="3" fill="none"><animateTransform attributeName="transform" type="rotate" from="0 20 20" to="360 20 20" dur="1.2s" repeatCount="indefinite"/></path></g></svg></div>`;
    } else {
      container.innerHTML = '';
    }
  }
  console.log('updateAvailableTimeSlots called, globals:', {
    businessOpeningHour: window.businessOpeningHour,
    businessClosingHour: window.businessClosingHour,
    beforeServiceBuffer: window.beforeServiceBuffer,
    afterServiceBuffer: window.afterServiceBuffer,
    minBookingAdvanceHours: window.minBookingAdvanceHours
  });
  if (
    window.businessOpeningHour === undefined ||
    window.businessClosingHour === undefined ||
    window.beforeServiceBuffer === undefined ||
    window.afterServiceBuffer === undefined ||
    window.minBookingAdvanceHours === undefined
  ) {
    console.warn('Business hours or buffer times are not set! Waiting for settings to load.');
    return;
  }
  // Define these variables first:
  const serviceId = document.getElementById('service').value;
  const durationVal = document.getElementById('duration').value;
  const genderVal = document.querySelector('input[name="genderPref"]:checked')?.value;
  // Now log them:
  console.log('Selected serviceId:', serviceId, 'Selected genderVal:', genderVal);
  if (!serviceId || !durationVal || !dateVal || !genderVal) return;

  // 1. Get buffer_time for selected service (not used here, but could be for after buffer)
  const durationMinutes = Number(durationVal);

  // 2. Get all therapists who match service and gender
  const { data: therapistLinks } = await window.supabase
    .from('therapist_services')
    .select('therapist_id, therapist:therapist_id (id, gender, is_active)')
    .eq('service_id', serviceId);
  console.log('Raw therapistLinks from Supabase:', therapistLinks);
  let therapists = (therapistLinks || []).map(row => row.therapist).filter(t => t && t.is_active);
  if (genderVal !== 'any') therapists = therapists.filter(t => t.gender === genderVal);
  
  // Deduplicate therapists to avoid redundant checks
  const uniqueTherapists = [...new Map(therapists.map(t => [t.id, t])).values()];
  console.log('Therapists after filtering & deduplication:', uniqueTherapists);

  // 3. For each therapist, get available slots
  let allSlots = [];
  for (const therapist of uniqueTherapists) {
    const slots = await getAvailableSlotsForTherapist(therapist, dateVal, durationMinutes);
    allSlots = allSlots.concat(slots);
  }
  console.log('All slots before deduplication:', allSlots);
  // 4. Deduplicate and sort
  const uniqueSlots = Array.from(new Set(allSlots)).sort();
  console.log('Unique available slots:', uniqueSlots);

  // 5. Filter out past slots if the selected date is today
  const today = new Date();
  const selectedDate = new Date(dateVal + 'T00:00:00'); // Use T00:00:00 to avoid timezone issues
  let finalSlots = uniqueSlots;

  if (selectedDate.getFullYear() === today.getFullYear() &&
    selectedDate.getMonth() === today.getMonth() &&
    selectedDate.getDate() === today.getDate()) {
    
    const now = new Date();
    now.setHours(now.getHours() + (window.minBookingAdvanceHours || 0));
    
    let earliestBookingHour = now.getHours();
    // If there are any minutes, round up to the next hour
    if (now.getMinutes() > 0 || now.getSeconds() > 0 || now.getMilliseconds() > 0) {
        earliestBookingHour++;
    }

    finalSlots = uniqueSlots.filter(slot => {
        const slotHour = parseInt(slot.split(':')[0], 10);
        return slotHour >= earliestBookingHour;
    });
    console.log(`Today's slots filtered. Earliest hour: ${earliestBookingHour}. Final slots:`, finalSlots);
  }

  // 6. Update time slots as buttons
  const timeInput = document.getElementById('time');
  if (finalSlots.length === 0) {
    renderTimeSlots([], '');
    timeInput.value = '';
    // Show error message
    const container = document.getElementById('timeSlotsContainer');
    if (container) {
      if (genderVal !== 'any') {
        container.innerHTML = `<div style='color:#b00; font-size:0.95rem; margin-top:0.3rem;'>Sorry we have no slots available for the ${genderVal === 'male' ? 'male' : 'female'} therapists in your area, please go back and change the setting to Any gender and try again.</div>`;
      } else {
        container.innerHTML = "<div style='color:#b00; font-size:0.95rem; margin-top:0.3rem;'>Sorry we have no therapists in your area available on that date, please try a different date.</div>";
      }
    }
  } else {
    renderTimeSlots(finalSlots, timeInput.value);
  }
}

// Add this function to update the therapist selection UI
async function updateTherapistSelection() {
  const serviceId = document.getElementById('service').value;
  const durationVal = document.getElementById('duration').value;
  const dateVal = document.getElementById('date').value;
  const timeVal = document.getElementById('time').value;
  const genderVal = document.querySelector('input[name="genderPref"]:checked')?.value;
  const therapistSelectionDiv = document.getElementById('therapistSelection');
  therapistSelectionDiv.innerHTML = '';
  if (!serviceId || !durationVal || !dateVal || !timeVal || !genderVal) return;

  // Get all therapists who match service and gender
  const { data: therapistLinks } = await window.supabase
    .from('therapist_services')
    .select('therapist_id, therapist:therapist_id (id, first_name, last_name, gender, is_active)')
    .eq('service_id', serviceId);
  let therapists = (therapistLinks || []).map(row => row.therapist).filter(t => t && t.is_active);
  if (genderVal !== 'any') therapists = therapists.filter(t => t.gender === genderVal);

  // Deduplicate therapists by id (fix for triplicates)
  const uniqueTherapists = Object.values(therapists.reduce((acc, t) => {
    if (t && t.id) acc[t.id] = t;
    return acc;
  }, {}));

  // For each therapist, check if they are available for the selected slot
  const availableTherapists = [];
  for (const therapist of uniqueTherapists) {
    const slots = await getAvailableSlotsForTherapist(therapist, dateVal, Number(durationVal));
    if (slots.includes(timeVal)) {
      availableTherapists.push(therapist);
    }
  }

  if (availableTherapists.length === 0) {
    therapistSelectionDiv.innerHTML = '<p>No therapists available for this slot.</p>';
    return;
  }

  // Render therapists as cards with images and bios
  availableTherapists.forEach(async (t) => {
    // Get bio and profile_pic from therapist_profiles table using therapist_id
    const { data: profileData } = await window.supabase
      .from('therapist_profiles')
      .select('bio, profile_pic')
      .eq('therapist_id', t.id)
      .single();
    
    const card = document.createElement('div');
    card.className = 'therapist-card';
    card.dataset.therapistId = t.id;
    
    const photoUrl = profileData?.profile_pic || null;
    const bio = profileData?.bio || 'No bio available';
    
    card.innerHTML = `
      ${photoUrl ? `<img src="${photoUrl}" alt="${t.first_name} ${t.last_name}" class="therapist-photo">` : ''}
      <div class="therapist-info">
        <div class="therapist-name">
          <span>${t.first_name} ${t.last_name}</span>
          <button type="button" class="read-more-btn" onclick="toggleTherapistBio(${t.id})">Read More</button>
        </div>
        <div class="therapist-bio" id="bio-${t.id}">
          <p>${bio}</p>
        </div>
        <input type="radio" name="therapistId" value="${t.id}" data-name="${t.first_name} ${t.last_name}" style="position: absolute; opacity: 0; pointer-events: none;">
      </div>
    `;
    
    // Add click handler for the entire card
    card.addEventListener('click', function(e) {
      if (e.target.classList.contains('read-more-btn')) return; // Don't trigger selection when clicking read more
      
      // Remove selection from other cards
      document.querySelectorAll('.therapist-card').forEach(c => c.classList.remove('selected'));
      
      // Select this card
      this.classList.add('selected');
      
      // Check the radio button
      const radio = this.querySelector('input[type="radio"]');
      radio.checked = true;
    });
    
    therapistSelectionDiv.appendChild(card);
  });
}

// Listen for changes to service, duration, date, gender
['service', 'duration', 'date'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', updateAvailableTimeSlots);
});
document.querySelectorAll('input[name="genderPref"]').forEach(el => {
  el.addEventListener('change', updateAvailableTimeSlots);
});

// Listen for changes to the time dropdown to update therapist selection
const timeSelect = document.getElementById('time');
timeSelect.addEventListener('change', updateTherapistSelection); 

// Also clear the error if the user changes date, duration, or gender
['service', 'duration', 'date'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', function() {
    const err = document.getElementById('time-availability-error');
    if (err) err.textContent = '';
  });
});
document.querySelectorAll('input[name="genderPref"]').forEach(el => {
  el.addEventListener('change', function() {
    const err = document.getElementById('time-availability-error');
    if (err) err.textContent = '';
  });
}); 

// Toggle therapist bio visibility
function toggleTherapistBio(therapistId) {
  const card = document.querySelector(`[data-therapist-id="${therapistId}"]`);
  const bio = document.getElementById(`bio-${therapistId}`);
  const photo = card.querySelector('.therapist-photo');
  const readMoreBtn = card.querySelector('.read-more-btn');
  
  if (card.classList.contains('expanded')) {
    // Collapse
    card.classList.remove('expanded');
    bio.classList.remove('expanded');
    photo.classList.remove('expanded');
    readMoreBtn.textContent = 'Read More';
  } else {
    // Expand
    card.classList.add('expanded');
    bio.classList.add('expanded');
    photo.classList.add('expanded');
    readMoreBtn.textContent = 'Show Less';
  }
}

// STRIPE INTEGRATION
let stripe, elements, card;
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51PGxKUKn3GaB6FyY1qeTOeYxWnBMDax8bUZhdP7RggDi1OyUp4BbSJWPhgb7hcvDynNqakuSfpGzwfuVhOsTvXmb001lwoCn7a';

function mountStripeCardElement() {
  if (!window.Stripe) {
    return;
  }
  stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);
  elements = stripe.elements();
  card = elements.create('card', {
    style: {
      base: {
        fontSize: '16px',
        color: '#333',
        fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
        '::placeholder': { color: '#888' },
      },
      invalid: { color: '#b00' }
    }
  });
  card.mount('#card-element');
}

// Mount Stripe card when Step 8 is shown
function observeStep8Mount() {
  const step8 = document.getElementById('step8');
  const observer = new MutationObserver(() => {
    if (step8.classList.contains('active') && !document.querySelector('#card-element iframe')) {
      mountStripeCardElement();
    }
  });
  observer.observe(step8, { attributes: true, attributeFilter: ['class'] });
}
observeStep8Mount();

// Populate booking summary in Step 9
async function populateBookingSummary() {
  const summaryDiv = document.getElementById('bookingSummaryDetails');
  if (!summaryDiv) return;
  
  // Generate booking ID if not already generated
  if (!window.lastBookingId) {
    window.lastBookingId = await generateSequentialBookingId();
  }
  
  // Gather details
  const addressInput = document.getElementById('address');
  const bookingType = document.querySelector('input[name="bookingType"]:checked')?.value || null;
  let businessName = '';
  if (bookingType === 'Corporate Event/Office') {
    businessName = document.getElementById('businessName').value;
  } else if (bookingType === 'Hotel/Accommodation') {
    businessName = addressInput.dataset.businessName || '';
  } else {
    businessName = 'N/A';
  }
  const address = addressInput.value;
  const service = document.getElementById('service').selectedOptions[0]?.textContent || '';
  const duration = document.getElementById('duration').value;
  const gender = document.querySelector('input[name="genderPref"]:checked')?.value || '';
  const date = document.getElementById('date').value;
  const time = document.getElementById('time').value;
  const parking = document.getElementById('parking').value;
  const therapist = document.querySelector('input[name="therapistId"]:checked')?.dataset?.name || '';
  const customerName = (document.getElementById('customerFirstName')?.value || '') + ' ' + (document.getElementById('customerLastName')?.value || '');
  const customerEmail = document.getElementById('customerEmail')?.value || '';
  const customerPhone = document.getElementById('customerPhone')?.value || '';
  const roomNumber = document.getElementById('roomNumber')?.value || '';
  const bookerName = document.getElementById('bookerName')?.value || '';
  const notes = document.getElementById('notes')?.value || '';
  const price = document.getElementById('priceAmount').textContent;
  const priceBreakdown = document.getElementById('priceBreakdown').innerHTML;
  
  // Calculate therapist fee
  const therapist_fee = calculateTherapistFee(date, time, duration);
  const therapist_fee_display = therapist_fee ? `$${therapist_fee.toFixed(2)}` : 'N/A';
  // Get customer_id and booking_id if available
  const customer_id = window.lastBookingCustomerId || '';
  const booking_id = window.lastBookingId || '';
  const customer_code = window.lastCustomerCode || '';
  summaryDiv.innerHTML = `
    <h3>Booking Details</h3>
    ${booking_id ? `<p><strong>Booking ID:</strong> ${booking_id}</p>` : ''}
    ${customer_code ? `<p><strong>Customer Code:</strong> ${customer_code}</p>` : ''}
    ${businessName && businessName !== 'N/A' ? `<p><strong>Business Name:</strong> ${businessName}</p>` : ''}
    <p><strong>Address:</strong> ${address}</p>
    <p><strong>Service:</strong> ${service}</p>
    <p><strong>Duration:</strong> ${duration} minutes</p>
    <p><strong>Therapist Gender Preference:</strong> ${gender}</p>
    <p><strong>Date & Time:</strong> ${date} at ${time}</p>
    <p><strong>Parking:</strong> ${parking}</p>
    <p><strong>Therapist:</strong> ${therapist}</p>
    <p><strong>Name:</strong> ${customerName}</p>
    <p><strong>Email:</strong> ${customerEmail}</p>
    <p><strong>Phone:</strong> ${customerPhone}</p>
    <p><strong>Room Number:</strong> ${roomNumber}</p>
    <p><strong>Booker Name:</strong> ${bookerName}</p>
    <p><strong>Notes:</strong> ${notes}</p>
    <p><strong>Estimated Price:</strong> $${price}</p>
    ${priceBreakdown ? `<div style="margin-left: 20px; font-size: 0.9em; color: #666;">${priceBreakdown}</div>` : ''}
    <p><strong>Therapist Fee:</strong> ${therapist_fee_display}</p>
  `;
}
// Show summary when entering Step 9
const step9 = document.getElementById('step9');
const observer9 = new MutationObserver(() => {
  if (step9.classList.contains('active')) {
    populateBookingSummary().catch(error => {
      console.error('Error populating booking summary:', error);
    });
  }
});
observer9.observe(step9, { attributes: true, attributeFilter: ['class'] });

// Handle booking confirmation on Step 10
const step10 = document.getElementById('step10');
const observer10 = new MutationObserver(() => {
  if (step10.classList.contains('active')) {
    document.getElementById('confirmationDetails').innerHTML = '<h3>Booking Request Submitted</h3><p>Your booking request has been submitted. You will receive an update by email once a therapist accepts or declines your request.</p>';
  }
});
observer10.observe(step10, { attributes: true, attributeFilter: ['class'] });

// Helper to generate customer_code
async function generateCustomerCode(surname) {
  if (!surname || surname.length < 1) return null;
  
  // Query for existing CUST codes to find the next number
  const { data: existing, error } = await window.supabase
    .from('customers')
    .select('customer_code')
    .ilike('customer_code', 'CUST%');
  
  let maxNum = 0;
  if (existing && existing.length > 0) {
    existing.forEach(row => {
      const match = row.customer_code && row.customer_code.match(/CUST(\d{4})$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
  }
  
  const nextNum = (maxNum + 1).toString().padStart(4, '0');
  return `CUST${nextNum}`;
}

// Helper to generate sequential booking ID
async function generateSequentialBookingId() {
  try {
    // Get current year and month
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const yearMonth = `${year}${month}`;
    
    // Query for the last booking ID in the current month
    const { data: lastBooking, error } = await window.supabase
      .from('bookings')
      .select('booking_id')
      .ilike('booking_id', `RMM${yearMonth}-%`)
      .order('booking_id', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching last booking ID:', error);
      // Fallback to first booking of the month
      return `RMM${yearMonth}-0001`;
    }
    
    let nextNumber = 1;
    
    if (lastBooking && lastBooking.booking_id) {
      // Extract the number from the last booking ID
      const match = lastBooking.booking_id.match(/RMM\d{6}-(\d{4})$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    // Format the new booking ID
    const bookingId = `RMM${yearMonth}-${String(nextNumber).padStart(4, '0')}`;
    console.log('Generated booking ID:', bookingId);
    return bookingId;
    
  } catch (error) {
    console.error('Error generating booking ID:', error);
    // Fallback booking ID
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `RMM${year}${month}-0001`;
  }
}

// Add customer registration logic
async function getOrCreateCustomerId(firstName, lastName, email, phone, isGuest = false) {
  if (!email) return null;
  
  // Check if customer exists by email
  const { data: existing, error: fetchError } = await window.supabase
    .from('customers')
    .select('id, customer_code, first_name, last_name, is_guest')
    .eq('email', email)
    .maybeSingle();
    
  if (fetchError) {
    console.error('Error fetching customer:', fetchError);
    return null;
  }
  
  if (existing && existing.id) {
    // Customer exists - return existing ID
    window.lastCustomerCode = existing.customer_code || '';
    console.log('✅ Existing customer found:', existing);
    return existing.id;
  }
  
  // Customer doesn't exist - create new customer
  let customer_code;
  
  if (isGuest) {
    // Generate guest code using sequential numbering
    const { data: existing, error } = await window.supabase
      .from('customers')
      .select('customer_code')
      .ilike('customer_code', 'GUEST%');
    
    let maxNum = 0;
    if (existing && existing.length > 0) {
      existing.forEach(row => {
        const match = row.customer_code && row.customer_code.match(/GUEST(\d{4})$/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      });
    }
    
    const nextNum = (maxNum + 1).toString().padStart(4, '0');
    customer_code = `GUEST${nextNum}`;
  } else {
    // Generate regular customer code based on surname
    const surname = lastName || firstName || 'CUST';
    customer_code = await generateCustomerCode(surname);
  }
  
  // Insert new customer with correct column names
  const { data: inserted, error: insertError } = await window.supabase
    .from('customers')
    .insert([{ 
      first_name: firstName, 
      last_name: lastName, 
      email, 
      phone, 
      customer_code,
      is_guest: isGuest
    }])
    .select('id, customer_code')
    .maybeSingle();
    
  if (insertError) {
    console.error('Error inserting customer:', insertError);
    alert('There was an error registering your customer details. Please try again.');
    return null;
  }
  
  window.lastCustomerCode = inserted?.customer_code || '';
  console.log('✅ New customer created:', inserted);
  return inserted?.id || null;
}

// Show customer_code in Customer Details step after registration
const customerDetailsStep = document.getElementById('step6');
if (customerDetailsStep) {
  const observerCust = new MutationObserver(() => {
    if (customerDetailsStep.classList.contains('active')) {
      const codeDiv = document.getElementById('customerCodeDisplay');
      if (window.lastCustomerCode) {
        if (codeDiv) {
          codeDiv.textContent = `Here is your User ID: ${window.lastCustomerCode}`;
        } else {
          const newDiv = document.createElement('div');
          newDiv.id = 'customerCodeDisplay';
          newDiv.style = 'font-size:1.05rem; color:#007e8c; margin-top:8px; margin-bottom:8px; font-weight:600;';
          newDiv.textContent = `Here is your User ID: ${window.lastCustomerCode}`;
          customerDetailsStep.querySelector('.step-content').appendChild(newDiv);
        }
      } else if (codeDiv) {
        codeDiv.remove();
      }
    }
  });
  observerCust.observe(customerDetailsStep, { attributes: true, attributeFilter: ['class'] });
}

// Email-first customer lookup logic
const customerEmailInput = document.getElementById('customerEmail');
const customerLookupResult = document.getElementById('customerLookupResult');
const customerInfo = document.getElementById('customerInfo');
const registrationOption = document.getElementById('registrationOption');
const customerFirstNameInput = document.getElementById('customerFirstName');
const customerLastNameInput = document.getElementById('customerLastName');
const customerPhoneInput = document.getElementById('customerPhone');
const emailStatus = document.getElementById('emailStatus');

if (customerEmailInput) {
  customerEmailInput.addEventListener('blur', async function () {
    const email = customerEmailInput.value.trim();
    if (!email) {
      hideCustomerLookup();
      return;
    }
    
    // Show loading status
    emailStatus.innerHTML = '<span style="color:#007e8c;">⏳ Checking email...</span>';
    
    try {
      const { data: customer, error } = await window.supabase
        .from('customers')
        .select('id, first_name, last_name, phone, customer_code, is_guest')
        .eq('email', email)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching customer:', error);
        emailStatus.innerHTML = '<span style="color:#d32f2f;">❌ Error checking email</span>';
        return;
      }
      
      if (customer) {
        // Existing customer found
        showExistingCustomer(customer);
      } else {
        // New customer
        showNewCustomer();
      }
    } catch (error) {
      console.error('Error in customer lookup:', error);
      emailStatus.innerHTML = '<span style="color:#d32f2f;">❌ Error checking email</span>';
    }
  });
}

function showExistingCustomer(customer) {
  // Auto-fill the form fields
  if (customerFirstNameInput) customerFirstNameInput.value = customer.first_name || '';
  if (customerLastNameInput) customerLastNameInput.value = customer.last_name || '';
  if (customerPhoneInput) customerPhoneInput.value = customer.phone || '';
  
  // Show welcome message
  customerLookupResult.style.display = 'block';
  customerInfo.innerHTML = `
    <div>Welcome back, ${customer.first_name || 'Valued Customer'}!</div>
    <div style="font-size:0.9rem; margin-top:4px;">
      ${customer.is_guest ? 'Guest Customer' : 'Registered Customer'} • ID: ${customer.customer_code || 'N/A'}
    </div>
  `;
  
  // Hide registration option for existing customers
  registrationOption.style.display = 'none';
  
  // Update status
  emailStatus.innerHTML = '<span style="color:#4caf50;">✅ Customer found</span>';
  
  console.log('✅ Existing customer loaded:', customer);
}

function showNewCustomer() {
  // Clear form fields
  if (customerFirstNameInput) customerFirstNameInput.value = '';
  if (customerLastNameInput) customerLastNameInput.value = '';
  if (customerPhoneInput) customerPhoneInput.value = '';
  
  // Hide welcome message
  customerLookupResult.style.display = 'none';
  
  // Show registration option
  registrationOption.style.display = 'block';
  
  // Update status
  emailStatus.innerHTML = '<span style="color:#ff9800;">🆕 New customer</span>';
  
  console.log('🆕 New customer detected');
}

function hideCustomerLookup() {
  customerLookupResult.style.display = 'none';
  registrationOption.style.display = 'none';
  emailStatus.innerHTML = '';
}

// Send booking notifications via EmailJS
async function sendBookingNotifications(bookingData, bookingId) {
  console.log('📧 Starting email notifications...', { bookingData, bookingId });
  
  try {
    // Prepare email data with ALL required fields for the template
    const emailData = {
      ...bookingData,
      booking_id: bookingId,
      first_name: bookingData.first_name || '',
      last_name: bookingData.last_name || '',
      customer_name: `${bookingData.first_name || ''} ${bookingData.last_name || ''}`.trim(),
      customer_email: bookingData.customer_email,
      customer_phone: bookingData.customer_phone,
      service_name: bookingData.service_name || 'Massage Service',
      therapist_name: bookingData.therapist_name || 'Available Therapist',
      booking_date: bookingData.booking_date || new Date().toISOString().split('T')[0],
      booking_time: bookingData.booking_time || '09:00',
      total_price: bookingData.price ? `$${bookingData.price.toFixed(2)}` : 'N/A',
      // Add missing fields that the template expects
      address: bookingData.address || 'N/A',
      business_name: bookingData.business_name || '',
      room_number: bookingData.room_number || '',
      gender_preference: bookingData.gender_preference || 'No preference',
      parking: bookingData.parking || 'N/A',
      booker_name: bookingData.booker_name || '',
      notes: bookingData.notes || '',
      duration_minutes: bookingData.duration_minutes || '60'
    };
    
    // Send email notification
    const emailResult = await window.EmailService.sendBookingRequestReceived(emailData);
    
    if (emailResult.success) {
      console.log('✅ Email notification sent successfully');
      return { success: true, message: 'Email sent successfully' };
    } else {
      console.error('❌ Email notification failed:', emailResult.error);
      return { success: false, error: emailResult.error };
    }
    
  } catch (error) {
    console.error('❌ Error in sendBookingNotifications:', error);
    return { success: false, error: error.message };
  }
}

// Booking submission logic
document.addEventListener('DOMContentLoaded', function() {
const confirmBtn = document.querySelector('#step9 .btn.next.primary');
if (confirmBtn) {
  confirmBtn.addEventListener('click', async function (e) {
    e.preventDefault();
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Submitting...';
      
      try {
    // Gather all booking details
    const addressInput = document.getElementById('address');
    const bookingType = document.querySelector('input[name="bookingType"]:checked')?.value || null;
    let businessName = '';
    if (bookingType === 'Corporate Event/Office') {
      businessName = document.getElementById('businessName').value;
    } else if (bookingType === 'Hotel/Accommodation') {
      businessName = addressInput.dataset.businessName || '';
    }
        
        const lat = addressInput.dataset.lat ? Number(addressInput.dataset.lat) : null;
        const lng = addressInput.dataset.lng ? Number(addressInput.dataset.lng) : null;
    const serviceId = document.getElementById('service').value;
        const duration = document.getElementById('duration').value;
        const genderPref = document.querySelector('input[name="genderPref"]:checked')?.value;
        const fallbackOption = document.querySelector('input[name="fallbackOption"]:checked')?.value;
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;
        const therapistId = document.querySelector('input[name="therapistId"]:checked')?.value;
    const parking = document.getElementById('parking').value;
        
        // Get customer details
        const customerFirstName = document.getElementById('customerFirstName')?.value || '';
        const customerLastName = document.getElementById('customerLastName')?.value || '';
        const customerEmail = document.getElementById('customerEmail')?.value || '';
        const customerPhone = document.getElementById('customerPhone')?.value || '';
        const roomNumber = document.getElementById('roomNumber')?.value || '';
        const bookerName = document.getElementById('bookerName')?.value || '';
        const notes = document.getElementById('notes')?.value || '';
    const price = document.getElementById('priceAmount').textContent ? parseFloat(document.getElementById('priceAmount').textContent) : null;
        
    // Calculate therapist fee
        const therapist_fee = calculateTherapistFee(date, time, duration) || 0;
        
    // Compose booking_time as ISO string
    const booking_time = date && time ? `${date}T${time}:00` : null;
        
    // Registration option
    const registerOption = document.querySelector('input[name="registerOption"]:checked')?.value;
    let customer_id = null;
        
    if (registerOption === 'yes') {
          customer_id = await getOrCreateCustomerId(customerFirstName, customerLastName, customerEmail, customerPhone, false);
        } else {
          // Create guest customer
          customer_id = await getOrCreateCustomerId(customerFirstName, customerLastName, customerEmail, customerPhone, true);
        }
        
        // Get service name for email
        const serviceSelect = document.getElementById('service');
        const serviceName = serviceSelect.selectedOptions[0]?.textContent || 'Massage Service';
        
        // Get therapist name for email
        const therapistRadio = document.querySelector('input[name="therapistId"]:checked');
        const therapistName = therapistRadio?.dataset?.name || 'Available Therapist';
        
    // Build payload
    const payload = {
      address: addressInput.value,
      booking_type: bookingType,
      business_name: businessName,
      latitude: lat,
      longitude: lng,
      service_id: serviceId,
      duration_minutes: duration,
      gender_preference: genderPref,
      fallback_option: fallbackOption,
      booking_time,
      parking,
      therapist_id: therapistId,
          first_name: customerFirstName,
          last_name: customerLastName,
      customer_email: customerEmail,
      customer_phone: customerPhone,
      room_number: roomNumber,
      booker_name: bookerName,
      notes,
      price,
      therapist_fee,
      status: 'requested',
      payment_status: 'pending'
    };
        
        // Generate booking ID BEFORE inserting
        const bookingIdFormatted = await generateSequentialBookingId();
        window.lastBookingId = bookingIdFormatted;
        
    if (customer_id) payload.customer_id = customer_id;
    if (window.lastCustomerCode) payload.customer_code = window.lastCustomerCode;
        payload.booking_id = bookingIdFormatted; // Add booking ID to payload
        
    window.lastBookingCustomerId = customer_id || '';
        
        // Insert booking into Supabase with booking_id already included
    const { data, error } = await window.supabase.from('bookings').insert([payload]).select();
    console.log('Supabase insert result:', { data, error });
        
    if (error) {
      console.error('Supabase insert error:', error);
      alert('There was an error submitting your booking. Please try again.\n' + (error.message || ''));
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirm and Request Booking';
      return;
    }

    if (!data || data.length === 0) {
      console.error('No booking data returned from insert');
      alert('There was an error submitting your booking. Please try again.');
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirm and Request Booking';
      return;
    }

        console.log('✅ Booking created with booking_id:', bookingIdFormatted, 'and customer_code:', window.lastCustomerCode);

    // Send email notifications
    console.log('📧 Starting email notifications...');
        const emailData = {
          ...payload,
          service_name: serviceName,
          therapist_name: therapistName,
          booking_date: date,
          booking_time: time
        };
        const emailResult = await sendBookingNotifications(emailData, bookingIdFormatted);
    console.log('📧 Email notification result:', emailResult);

    // Show success message
    alert('Your booking request has been submitted successfully! You will receive a confirmation email shortly.');
    
    // Move to confirmation step
    showStep(10);
        
      } catch (error) {
        console.error('❌ Error in booking submission:', error);
        alert('There was an error submitting your booking. Please try again.');
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirm and Request Booking';
      }
    });
  }
}); 
