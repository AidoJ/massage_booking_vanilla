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
  const rate = isAfterhours ? window.therapistAfterhoursRate : window.therapistDaytimeRate;
  if (!rate) return null;
  const durationMultiplier = Number(durationVal) / 60;
  return Math.round(rate * durationMultiplier * 100) / 100;
}

document.addEventListener('DOMContentLoaded', function () {
  const steps = Array.from(document.querySelectorAll('.step'));
  const progressSteps = Array.from(document.querySelectorAll('.progress-step'));

  // Disable past dates on the date picker
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-11
  const dd = String(today.getDate()).padStart(2, '0');
  document.getElementById('date').setAttribute('min', `${yyyy}-${mm}-${dd}`);

  function showStep(stepId) {
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
  
  Promise.all([
    populateTherapyOptions(),
    fetchPricingData(),
    fetchSettings()
  ]).then(() => {
    console.log('✅ All data loaded successfully');
    setupPriceListeners();
    // Remove loading indicator
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
  }).catch(error => {
    console.error('❌ Error loading initial data:', error);
    // Remove loading indicator even on error
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
        const name = document.getElementById('customerName');
        const email = document.getElementById('customerEmail');
        const phone = document.getElementById('customerPhone');
        if (!name.value) {
          isValid = false;
          showError(name, 'Please enter your full name.');
        }
        if (!email.value) {
          isValid = false;
          showError(email, 'Please enter your email address.');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
          isValid = false;
          showError(email, 'Please enter a valid email address.');
        }
        if (!phone.value) {
          isValid = false;
          showError(phone, 'Please enter your phone number.');
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
    // Fetch services
    const { data: services, error: serviceError } = await window.supabase
      .from('services')
      .select('id, name, is_active')
      .eq('is_active', true)
      .order('sort_order');
    console.log('Supabase services:', services, 'Error:', serviceError);
    const serviceSelect = document.getElementById('service');
    if (serviceSelect) {
      serviceSelect.innerHTML = '<option value="">Select a service...</option>';
      if (services) {
        services.forEach(service => {
          const opt = document.createElement('option');
          opt.value = service.id;
          opt.textContent = service.name;
          serviceSelect.appendChild(opt);
        });
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
      if (durations) {
        durations.forEach(duration => {
          const opt = document.createElement('option');
          opt.value = duration.duration_minutes;
          opt.textContent = duration.duration_minutes; // Only show the raw value
          durationSelect.appendChild(opt);
        });
      }
    }
  }

  let servicesCache = [];
  let durationsCache = [];
  let timePricingRulesCache = [];
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
    // Fetch services
    const { data: services } = await window.supabase
      .from('services')
      .select('id, name, service_base_price, is_active')
      .eq('is_active', true)
      .order('sort_order');
    servicesCache = services || [];

    // Fetch durations
    const { data: durations } = await window.supabase
      .from('duration_pricing')
      .select('id, duration_minutes, uplift_percentage, is_active')
      .eq('is_active', true)
      .order('sort_order');
    durationsCache = durations || [];

    // Fetch time pricing rules
    const { data: timeRules } = await window.supabase
      .from('time_pricing_rules')
      .select('id, day_of_week, start_time, end_time, uplift_percentage, is_active, label')
      .eq('is_active', true)
      .order('sort_order');
    timePricingRulesCache = timeRules || [];
  }

  async function fetchSettings() {
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
  }

  function calculatePrice() {
    const serviceId = document.getElementById('service').value;
    const durationVal = document.getElementById('duration').value;
    const dateVal = document.getElementById('date').value;
    const timeVal = document.getElementById('time').value;
    if (!serviceId || !durationVal || !dateVal || !timeVal) return;

    // Get base price
    const service = servicesCache.find(s => s.id === serviceId);
    if (!service) return;
    let price = Number(service.service_base_price);

    // Get duration uplift
    const duration = durationsCache.find(d => String(d.duration_minutes) === String(durationVal));
    if (duration && duration.uplift_percentage) {
      price += price * (Number(duration.uplift_percentage) / 100);
    }

    // Get day of week and time
    const dayOfWeek = new Date(dateVal).getDay(); // 0=Sunday, 6=Saturday
    // Find matching time pricing rule from table
    let timeUplift = 0;
    for (const rule of timePricingRulesCache) {
      if (Number(rule.day_of_week) === dayOfWeek) {
        if (timeVal >= rule.start_time && timeVal < rule.end_time) {
          timeUplift = Number(rule.uplift_percentage);
          break;
        }
      }
    }
    if (timeUplift) {
      price += price * (timeUplift / 100);
    }

    // Update price display (no breakdown)
    document.getElementById('priceAmount').textContent = price.toFixed(2);
    document.getElementById('priceBreakdown').innerHTML = '';
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

  // Render therapists as radio buttons
  availableTherapists.forEach(t => {
    const card = document.createElement('div');
    card.className = 'therapist-card horizontal';
    card.innerHTML = `
      <label class="therapist-radio-label" style="display:flex;align-items:center;justify-content:space-between;width:100%;">
        <span class="therapist-name">${t.first_name} ${t.last_name}</span>
        <input type="radio" name="therapistId" value="${t.id}" class="therapist-radio-custom">
      </label>
    `;
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
function populateBookingSummary() {
  const summaryDiv = document.getElementById('bookingSummaryDetails');
  if (!summaryDiv) return;
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
  const customerName = document.getElementById('customerName').value;
  const customerEmail = document.getElementById('customerEmail').value;
  const customerPhone = document.getElementById('customerPhone').value;
  const roomNumber = document.getElementById('roomNumber').value;
  const bookerName = document.getElementById('bookerName').value;
  const notes = document.getElementById('notes').value;
  const price = document.getElementById('priceAmount').textContent;
  const therapist_fee = calculateTherapistFee(date, time, duration);
  // Get customer_id and booking_id if available
  const customer_id = window.lastBookingCustomerId || '';
  const booking_id = window.lastBookingId || '';
  summaryDiv.innerHTML = `
    <h3>Booking Details</h3>
    ${booking_id ? `<p><strong>Booking ID:</strong> ${booking_id}</p>` : ''}
    ${customer_id ? `<p><strong>Customer ID:</strong> ${customer_id}</p>` : ''}
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
    <p><strong>Therapist Fee:</strong> $${therapist_fee}</p>
  `;
}
// Show summary when entering Step 9
const step9 = document.getElementById('step9');
const observer9 = new MutationObserver(() => {
  if (step9.classList.contains('active')) {
    populateBookingSummary();
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
  const last4 = surname.slice(-4).toLowerCase();
  // Count existing codes with this suffix
  const { data: existing, error } = await window.supabase
    .from('customers')
    .select('customer_code')
    .ilike('customer_code', `%${last4}%`);
  let maxNum = 0;
  if (existing && existing.length > 0) {
    existing.forEach(row => {
      const match = row.customer_code && row.customer_code.match(/([a-z]{1,4})(\d{4})$/);
      if (match && match[1] === last4) {
        const num = parseInt(match[2], 10);
        if (num > maxNum) maxNum = num;
      }
    });
  }
  const nextNum = (maxNum + 1).toString().padStart(4, '0');
  return `${last4}${nextNum}`;
}

// Add customer registration logic
async function getOrCreateCustomerId(name, email, phone) {
  if (!email) return null;
  // Check if customer exists
  const { data: existing, error: fetchError } = await window.supabase
    .from('customers')
    .select('id, customer_code')
    .eq('email', email)
    .maybeSingle();
  if (fetchError) {
    console.error('Error fetching customer:', fetchError);
    return null;
  }
  if (existing && existing.id) {
    window.lastCustomerCode = existing.customer_code || '';
    return existing.id;
  }
  // Generate customer_code
  const surname = name.trim().split(' ').slice(-1)[0];
  const customer_code = await generateCustomerCode(surname);
  // Insert new customer
  const { data: inserted, error: insertError } = await window.supabase
    .from('customers')
    .insert([{ name, email, phone, customer_code }])
    .select('id, customer_code')
    .maybeSingle();
  if (insertError) {
    console.error('Error inserting customer:', insertError);
    alert('There was an error registering your customer details. Please try again.');
    return null;
  }
  window.lastCustomerCode = inserted?.customer_code || '';
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

// Auto-fill customer details if returning
const customerEmailInput = document.getElementById('customerEmail');
if (customerEmailInput) {
  customerEmailInput.addEventListener('blur', async function () {
    const email = customerEmailInput.value;
    if (!email) return;
    const { data: customer, error } = await window.supabase
      .from('customers')
      .select('name, phone')
      .eq('email', email)
      .maybeSingle();
    if (customer && customer.name) {
      document.getElementById('customerName').value = customer.name;
      if (customer.phone) document.getElementById('customerPhone').value = customer.phone;
    }
  });
}

// Update booking submission logic to include customer_code in bookings
const confirmBtn = document.querySelector('#step9 .btn.next.primary');
if (confirmBtn) {
  confirmBtn.addEventListener('click', async function (e) {
    e.preventDefault();
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Submitting...';
    // Gather all booking details
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
    const lat = addressInput.dataset.lat ? parseFloat(addressInput.dataset.lat) : null;
    const lng = addressInput.dataset.lng ? parseFloat(addressInput.dataset.lng) : null;
    const serviceId = document.getElementById('service').value;
    const duration = document.getElementById('duration').value ? parseInt(document.getElementById('duration').value, 10) : null;
    const genderPref = document.querySelector('input[name="genderPref"]:checked')?.value || '';
    const fallbackOption = document.querySelector('input[name="fallbackOption"]:checked')?.value || '';
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;
    const parking = document.getElementById('parking').value;
    const therapistId = document.querySelector('input[name="therapistId"]:checked')?.value || null;
    const customerName = document.getElementById('customerName').value;
    const customerEmail = document.getElementById('customerEmail').value;
    const customerPhone = document.getElementById('customerPhone').value;
    const roomNumber = document.getElementById('roomNumber').value;
    const bookerName = document.getElementById('bookerName').value;
    const notes = document.getElementById('notes').value;
    const price = document.getElementById('priceAmount').textContent ? parseFloat(document.getElementById('priceAmount').textContent) : null;
    // Calculate therapist fee
    const therapist_fee = calculateTherapistFee(date, time, duration);
    // Compose booking_time as ISO string
    const booking_time = date && time ? `${date}T${time}:00` : null;
    // Registration option
    const registerOption = document.querySelector('input[name="registerOption"]:checked')?.value;
    let customer_id = null;
    if (registerOption === 'yes') {
      customer_id = await getOrCreateCustomerId(customerName, customerEmail, customerPhone);
    }
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
      customer_name: customerName,
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
    if (customer_id) payload.customer_id = customer_id;
    if (window.lastCustomerCode) payload.customer_code = window.lastCustomerCode;
    window.lastBookingCustomerId = customer_id || '';
    // Insert booking into Supabase
    const { data, error } = await window.supabase.from('bookings').insert([payload]);
    console.log('Supabase insert result:', { data, error });
    if (error) {
      console.error('Supabase insert error:', error);
      alert('There was an error submitting your booking. Please try again.\n' + (error.message || ''));
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Confirm and Request Booking';
      return;
    }

    // Generate booking ID and update the record
    const bookingId = data[0].id;
    const bookingIdFormatted = generateBookingId(bookingId);
    window.lastBookingId = bookingIdFormatted;
    
    // Update booking with the formatted ID
    const { error: updateError } = await window.supabase
      .from('bookings')
      .update({ booking_id: bookingIdFormatted })
      .eq('id', bookingId);
    
    if (updateError) {
      console.error('Error updating booking ID:', updateError);
    }

    // Send email notifications
    await sendBookingNotifications(payload, bookingIdFormatted);

    // Show success message
    alert('Your booking request has been submitted successfully! You will receive a confirmation email shortly.');
    
    // Move to confirmation step
    showStep(10);
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirm and Request Booking';
  });
}

// Handle payment submission on Step 9
const payBtn = document.getElementById('payBtn');
if (payBtn) {
  payBtn.addEventListener('click', async function (e) {
    e.preventDefault();
    payBtn.disabled = true;
    payBtn.textContent = 'Processing...';
    if (!stripe || !card) {
      alert('Payment form not ready. Please go back and try again.');
      payBtn.disabled = false;
      payBtn.textContent = 'Confirm and submit request';
      return;
    }
    setTimeout(() => {
      document.getElementById('confirmationDetails').innerHTML = '<h3>Booking Confirmed!</h3><p>Your payment was successful and your booking request has been submitted. You will receive a confirmation email shortly.</p>';
      payBtn.style.display = 'none';
    }, 1500);
    // Uncomment below for real Stripe integration:
    /*
    const {error, paymentIntent} = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: card },
    });
    if (error) {
      alert(error.message);
      payBtn.disabled = false;
      payBtn.textContent = 'Confirm and submit request';
      return;
    }
    // Success UI
    document.getElementById('confirmationDetails').innerHTML = '<h3>Booking Confirmed!</h3><p>Your payment was successful and your booking request has been submitted. You will receive a confirmation email shortly.</p>';
    payBtn.style.display = 'none';
    */
  });
} 

// Add styles for time slot buttons
const style = document.createElement('style');
style.textContent = `
.time-slot-btn {
  display: inline-block;
  margin: 0 8px 8px 0;
  padding: 12px 20px;
  border: 2px solid #00729B;
  border-radius: 8px;
  background: #f8f9fa;
  color: #00729B;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}
.time-slot-btn.selected, .time-slot-btn:active {
  background: #00729B;
  color: #fff;
  border-color: #00729B;
  box-shadow: 0 2px 8px rgba(0, 112, 155, 0.15);
}
.time-slot-btn:hover:not(.selected) {
  background: #e3f2fd;
  border-color: #1976d2;
}
`;
document.head.appendChild(style); 

// Add spinner styles (egg-timer)
const spinnerStyle = document.createElement('style');
spinnerStyle.textContent = `
.spinner-container {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-height: 48px;
  margin-bottom: 0.5rem;
}
.egg-timer {
  display: inline-block;
  animation: egg-timer-spin 1.2s linear infinite;
}
@keyframes egg-timer-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;
document.head.appendChild(spinnerStyle); 

// Add validation error styles
const validationStyle = document.createElement('style');
validationStyle.textContent = `
.error-message {
  color: #b00;
  font-size: 0.9rem;
  font-weight: 500;
  margin-top: 5px;
  margin-bottom: 10px;
  animation: shake 0.3s;
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}
`;
document.head.appendChild(validationStyle); 

// Helper function to generate booking ID
function generateBookingId(uuid) {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const seq = uuid.replace(/-/g, '').slice(-4);
  return `RMM${year}${month}${seq}`;
}

// Add this function after the existing functions
async function sendBookingNotifications(bookingData, bookingId) {
  try {
    // Get settings for timeout
    const { data: settings } = await window.supabase.from('settings').select('*').single();
    const responseTimeout = settings?.therapist_response_timeout_minutes || 2;

    // Prepare email data
    const emailData = {
      booking_id: bookingId,
      customer_name: bookingData.customer_name,
      customer_email: bookingData.customer_email,
      customer_phone: bookingData.customer_phone,
      service_name: '', // Will be populated from service lookup
      duration_minutes: bookingData.duration_minutes,
      booking_time: bookingData.booking_time,
      address: bookingData.address,
      room_number: bookingData.room_number,
      booker_name: bookingData.booker_name,
      price: bookingData.price,
      therapist_fee: bookingData.therapist_fee,
      response_timeout: responseTimeout
    };

    // Get service name
    const { data: service } = await window.supabase
      .from('services')
      .select('name')
      .eq('id', bookingData.service_id)
      .single();
    
    if (service) {
      emailData.service_name = service.name;
    }

    // Get available therapists for this service
    const { data: therapists } = await window.supabase
      .from('therapist_profiles')
      .select(`
        *,
        therapist_services!inner(service_id)
      `)
      .eq('therapist_services.service_id', bookingData.service_id)
      .eq('is_active', true);

    if (therapists && therapists.length > 0) {
      // Send notification to all available therapists
      const therapistResults = await window.EmailService.sendTherapistNotification(emailData, therapists);
      console.log('Therapist notification results:', therapistResults);
    }

    // Send confirmation email to client
    const clientResult = await window.EmailService.sendClientConfirmation(emailData);
    console.log('Client confirmation result:', clientResult);

  } catch (error) {
    console.error('Error sending booking notifications:', error);
  }
} 