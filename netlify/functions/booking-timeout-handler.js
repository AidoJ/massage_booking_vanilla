// COMPLETE UPDATED booking-timeout-handler.js - Fixed first therapist timeout logic
// Replace your entire netlify/functions/booking-timeout-handler.js with this code

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://dcukfurezlkagvvwgsgr.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjdWtmdXJlemxrYWd2dndnc2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MjM0NjQsImV4cCI6MjA2NzQ5OTQ2NH0.ThXQKNHj0XpSkPa--ghmuRXFJ7nfcf0YVlH0liHofFw';
const supabase = createClient(supabaseUrl, supabaseKey);

// EmailJS configuration
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_puww2kb';
const EMAILJS_THERAPIST_REQUEST_TEMPLATE_ID = process.env.EMAILJS_THERAPIST_REQUEST_TEMPLATE_ID || 'template_51wt6of';
const EMAILJS_LOOKING_ALTERNATE_TEMPLATE_ID = process.env.EMAILJS_LOOKING_ALTERNATE_TEMPLATE_ID || 'template_alternate';
const EMAILJS_BOOKING_DECLINED_TEMPLATE_ID = process.env.EMAILJS_BOOKING_DECLINED_TEMPLATE_ID || 'template_declined';
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'qfM_qA664E4JddSMN';
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

exports.handler = async (event, context) => {
  console.log('🕐 Starting booking timeout check...');
  
  try {
    // Get timeout settings from database
    const { data: timeoutSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'therapist_response_timeout_minutes')
      .single();

    const timeoutMinutes = timeoutSetting && timeoutSetting.value ? parseInt(timeoutSetting.value) : 60;
    console.log('⏰ Using timeout:', timeoutMinutes, 'minutes');

    // Find bookings that need timeout processing
    const bookingsToProcess = await findBookingsNeedingTimeout(timeoutMinutes);
    console.log('📊 Found', bookingsToProcess.length, 'bookings needing timeout processing');

    if (bookingsToProcess.length === 0) {
      console.log('✅ No bookings need timeout processing');
      return { statusCode: 200, body: 'No timeouts to process' };
    }

    // Process each booking
    const results = [];
    for (const booking of bookingsToProcess) {
      console.log('🔄 Processing booking:', booking.booking_id, 'status:', booking.status, 'stage:', booking.timeoutStage);
      const result = await processBookingTimeout(booking, timeoutMinutes);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    console.log('✅ Processed', successCount + '/' + results.length, 'bookings successfully');

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Processed ' + successCount + '/' + results.length + ' bookings',
        results: results
      })
    };

  } catch (error) {
    console.error('❌ Error in timeout handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// UPDATED: Find bookings that need timeout processing (fixed first therapist timeout)
async function findBookingsNeedingTimeout(timeoutMinutes) {
  try {
    const now = new Date();
    const firstTimeoutCutoff = new Date(now.getTime() - timeoutMinutes * 60 * 1000);
    const secondTimeoutCutoff = new Date(now.getTime() - (timeoutMinutes * 2) * 60 * 1000);
    
    console.log('🔍 Looking for bookings needing timeout processing...');
    console.log('📅 First timeout cutoff:', firstTimeoutCutoff.toISOString());
    console.log('📅 Second timeout cutoff:', secondTimeoutCutoff.toISOString());

    // FIXED: Find bookings for FIRST timeout (status = 'requested' and past first timeout AND no therapist response)
    const { data: firstTimeoutBookings, error: error1 } = await supabase
      .from('bookings')
      .select('*, services(id, name), customers(id, first_name, last_name, email, phone), therapist_profiles!therapist_id(id, first_name, last_name, email)')
      .eq('status', 'requested')
      .is('therapist_response_time', null) // IMPORTANT: Only if therapist hasn't responded yet
      .lt('created_at', firstTimeoutCutoff.toISOString());

    if (error1) {
      console.error('❌ Error fetching first timeout bookings:', error1);
    } else {
      console.log('📊 First timeout bookings found:', firstTimeoutBookings ? firstTimeoutBookings.length : 0);
    }

    // Find bookings for SECOND timeout (status = 'timeout_reassigned' or 'seeking_alternate' and past second timeout)
    const { data: secondTimeoutBookings, error: error2 } = await supabase
      .from('bookings')
      .select('*, services(id, name), customers(id, first_name, last_name, email, phone), therapist_profiles!therapist_id(id, first_name, last_name, email)')
      .in('status', ['timeout_reassigned', 'seeking_alternate'])
      .lt('created_at', secondTimeoutCutoff.toISOString());

    if (error2) {
      console.error('❌ Error fetching second timeout bookings:', error2);
    } else {
      console.log('📊 Second timeout bookings found:', secondTimeoutBookings ? secondTimeoutBookings.length : 0);
    }

    const allBookings = [
      ...(firstTimeoutBookings || []).map(b => ({ ...b, timeoutStage: 'first' })),
      ...(secondTimeoutBookings || []).map(b => ({ ...b, timeoutStage: 'second' }))
    ];

    console.log('📊 Total bookings to process:', allBookings.length);
    
    return allBookings;

  } catch (error) {
    console.error('❌ Error finding timeout bookings:', error);
    return [];
  }
}

// Process a single booking timeout
async function processBookingTimeout(booking, timeoutMinutes) {
  try {
    console.log('⚡ Processing', booking.timeoutStage, 'timeout for booking', booking.booking_id);
    
    if (booking.timeoutStage === 'first') {
      return await handleFirstTimeout(booking, timeoutMinutes);
    } else if (booking.timeoutStage === 'second') {
      return await handleSecondTimeout(booking);
    } else {
      console.log('⚠️ Unknown timeout stage for booking', booking.booking_id);
      return { success: false, booking_id: booking.booking_id, reason: 'Unknown timeout stage' };
    }

  } catch (error) {
    console.error('❌ Error processing booking', booking.booking_id + ':', error);
    return { success: false, booking_id: booking.booking_id, error: error.message };
  }
}

// UPDATED: Handle first timeout - check fallback preference properly
async function handleFirstTimeout(booking, timeoutMinutes) {
  try {
    console.log('🔄 First timeout for booking', booking.booking_id, '- fallback_option:', booking.fallback_option);

    // FIXED: Check if customer wants alternatives
    if (booking.fallback_option === 'yes') {
      console.log('✅ Customer wants alternatives - finding available therapists');
      
      // Find ALL available therapists for this specific time slot (excluding original)
      const availableTherapists = await findAllAvailableTherapistsForTimeSlot(booking, booking.therapist_id);
      
      if (availableTherapists.length === 0) {
        console.log('❌ No alternative therapists available for', booking.booking_id, '- declining immediately');
        await sendClientDeclineEmail(booking);
        await updateBookingStatus(booking.booking_id, 'declined');
        await addStatusHistory(booking.id, 'declined', null, 'Automatic timeout - no available therapists');
        return { success: true, booking_id: booking.booking_id, action: 'declined_no_alternatives' };
      }

      // 1. FIRST: Send "Looking for Alternate" email to customer
      await sendClientLookingForAlternateEmail(booking);

      // 2. CRITICAL: Update booking status to prevent reprocessing
      await updateBookingStatus(booking.booking_id, 'timeout_reassigned');
      await addStatusHistory(booking.id, 'timeout_reassigned', null, 'Reassigned to ' + availableTherapists.length + ' therapists after first timeout');

      // 3. Send booking requests to ALL available therapists  
      const emailResults = await sendBookingRequestsToMultipleTherapists(booking, availableTherapists, timeoutMinutes);
      
      console.log('📧 Sent booking requests to', availableTherapists.length, 'therapists');
      console.log('✅ Email success rate:', emailResults.filter(r => r.success).length + '/' + emailResults.length);

      return {
        success: true,
        booking_id: booking.booking_id,
        action: 'reassigned_to_multiple',
        therapist_count: availableTherapists.length,
        email_results: emailResults
      };

    } else {
      // Customer doesn't want alternatives - decline immediately
      console.log('❌ Customer does not want alternatives - declining booking', booking.booking_id);
      await sendClientDeclineEmail(booking);
      await updateBookingStatus(booking.booking_id, 'declined');
      await addStatusHistory(booking.id, 'declined', null, 'Automatic timeout - customer declined alternatives');
      
      return {
        success: true,
        booking_id: booking.booking_id,
        action: 'declined_no_fallback'
      };
    }

  } catch (error) {
    console.error('❌ Error in first timeout for', booking.booking_id + ':', error);
    return { success: false, booking_id: booking.booking_id, error: error.message };
  }
}

// Handle second timeout - final decline
async function handleSecondTimeout(booking) {
  try {
    console.log('⏰ Second timeout for booking', booking.booking_id, '- sending final decline');

    // Send final decline email to client
    await sendClientDeclineEmail(booking);

    // CRITICAL: Update booking status to prevent reprocessing
    await updateBookingStatus(booking.booking_id, 'declined');
    await addStatusHistory(booking.id, 'declined', null, 'Automatic final timeout - no therapist responses');

    return {
      success: true,
      booking_id: booking.booking_id,
      action: 'final_decline'
    };

  } catch (error) {
    console.error('❌ Error in second timeout for', booking.booking_id + ':', error);
    return { success: false, booking_id: booking.booking_id, error: error.message };
  }
}

// NEW: Find all available therapists for a specific time slot (same logic as booking-response.js)
async function findAllAvailableTherapistsForTimeSlot(booking, excludeTherapistId) {
  try {
    console.log('🔍 Finding ALL available therapists for', booking.booking_id, ', excluding', excludeTherapistId);
    console.log('📅 Booking time:', booking.booking_time);

    // Get therapists who provide this service
    const { data: therapistLinks } = await supabase
      .from('therapist_services')
      .select('therapist_id, therapist_profiles!therapist_id (id, first_name, last_name, email, gender, is_active, latitude, longitude, service_radius_km)')
      .eq('service_id', booking.service_id);

    let candidateTherapists = (therapistLinks || [])
      .map(row => row.therapist_profiles)
      .filter(t => t && t.is_active && t.id !== excludeTherapistId);

    console.log('📊 Found', candidateTherapists.length, 'therapists who provide this service (excluding original)');

    // Filter by gender preference
    if (booking.gender_preference && booking.gender_preference !== 'any') {
      candidateTherapists = candidateTherapists.filter(t => t.gender === booking.gender_preference);
      console.log('📊 After gender filter (' + booking.gender_preference + '):', candidateTherapists.length, 'therapists');
    }

    // Filter by location (if available)
    if (booking.latitude && booking.longitude) {
      candidateTherapists = candidateTherapists.filter(t => {
        if (!t.latitude || !t.longitude || !t.service_radius_km) return false;
        const distance = calculateDistance(
          booking.latitude, booking.longitude,
          t.latitude, t.longitude
        );
        return distance <= t.service_radius_km;
      });
      console.log('📊 After location filter:', candidateTherapists.length, 'therapists');
    }

    // Filter by actual time slot availability
    const availableTherapists = [];
    const bookingDate = new Date(booking.booking_time);
    const dayOfWeek = bookingDate.getDay(); // 0=Sunday, 6=Saturday
    const bookingTimeOnly = bookingDate.toTimeString().slice(0, 5); // HH:MM format
    const bookingDateOnly = bookingDate.toISOString().split('T')[0]; // YYYY-MM-DD format

    console.log('🕐 Checking availability for:', bookingDateOnly, 'at', bookingTimeOnly, '(day', dayOfWeek + ')');

    for (const therapist of candidateTherapists) {
      try {
        // Check if therapist works on this day of week
        const { data: availability } = await supabase
          .from('therapist_availability')
          .select('start_time, end_time')
          .eq('therapist_id', therapist.id)
          .eq('day_of_week', dayOfWeek);

        if (!availability || availability.length === 0) {
          console.log('❌', therapist.first_name, therapist.last_name, 'does not work on day', dayOfWeek);
          continue;
        }

        const { start_time, end_time } = availability[0];
        
        // Check if booking time is within working hours
        if (bookingTimeOnly < start_time || bookingTimeOnly >= end_time) {
          console.log('❌', therapist.first_name, therapist.last_name, 'not available at', bookingTimeOnly, '(works', start_time, '-', end_time + ')');
          continue;
        }

        // Check for existing bookings at this time
        const { data: existingBookings } = await supabase
          .from('bookings')
          .select('booking_time, duration_minutes, status')
          .eq('therapist_id', therapist.id)
          .gte('booking_time', bookingDateOnly + 'T00:00:00')
          .lt('booking_time', bookingDateOnly + 'T23:59:59')
          .in('status', ['requested', 'confirmed', 'timeout_reassigned', 'seeking_alternate']);

        // Check for time conflicts
        let hasConflict = false;
        const bookingStart = new Date(booking.booking_time);
        const bookingEnd = new Date(bookingStart.getTime() + (booking.duration_minutes * 60000));

        for (const existingBooking of existingBookings || []) {
          const existingStart = new Date(existingBooking.booking_time);
          const existingEnd = new Date(existingStart.getTime() + (existingBooking.duration_minutes * 60000));
          
          // Check for overlap (with 15-minute buffer)
          const bufferMs = 15 * 60000; // 15 minutes in milliseconds
          const existingStartWithBuffer = new Date(existingStart.getTime() - bufferMs);
          const existingEndWithBuffer = new Date(existingEnd.getTime() + bufferMs);
          
          if (bookingStart < existingEndWithBuffer && bookingEnd > existingStartWithBuffer) {
            console.log('❌', therapist.first_name, therapist.last_name, 'has conflict with existing booking at', existingBooking.booking_time);
            hasConflict = true;
            break;
          }
        }

        if (!hasConflict) {
          console.log('✅', therapist.first_name, therapist.last_name, 'is available for', bookingDateOnly, 'at', bookingTimeOnly);
          availableTherapists.push(therapist);
        }

      } catch (error) {
        console.error('❌ Error checking availability for', therapist.first_name, therapist.last_name + ':', error);
        continue;
      }
    }

    // Remove duplicates by ID
    const uniqueTherapists = Array.from(
      new Map(availableTherapists.map(t => [t.id, t])).values()
    );

    console.log('📊 Final available therapists (after time slot check):', uniqueTherapists.length);
    uniqueTherapists.forEach(t => console.log('  ✅', t.first_name, t.last_name));
    
    return uniqueTherapists;

  } catch (error) {
    console.error('❌ Error finding available therapists:', error);
    return [];
  }
}

// Send booking requests to multiple therapists
async function sendBookingRequestsToMultipleTherapists(booking, therapists, timeoutMinutes) {
  const results = [];
  
  console.log('📧 Sending booking requests to', therapists.length, 'therapists...');
  
  for (const therapist of therapists) {
    try {
      console.log('📧 Sending to', therapist.first_name, therapist.last_name, '(' + therapist.email + ')');
      
      const result = await sendTherapistBookingRequest(booking, therapist, timeoutMinutes);
      results.push({
        therapist_id: therapist.id,
        therapist_name: therapist.first_name + ' ' + therapist.last_name,
        success: result.success,
        error: result.error
      });
      
      // Small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error('❌ Error sending to', therapist.first_name, therapist.last_name + ':', error);
      results.push({
        therapist_id: therapist.id,
        therapist_name: therapist.first_name + ' ' + therapist.last_name,
        success: false,
        error: error.message
      });
    }
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log('📧 Successfully sent', successCount + '/' + results.length, 'therapist emails');
  
  return results;
}

// Email functions
async function sendClientLookingForAlternateEmail(booking) {
  try {
    let serviceName = 'Massage Service';
    if (booking.services && booking.services.name) {
      serviceName = booking.services.name;
    }

    const templateParams = {
      to_email: booking.customer_email,
      to_name: booking.first_name + ' ' + booking.last_name,
      customer_name: booking.first_name + ' ' + booking.last_name,
      booking_id: booking.booking_id,
      service: serviceName,
      duration: booking.duration_minutes + ' minutes',
      date_time: new Date(booking.booking_time).toLocaleString(),
      address: booking.address
    };

    const result = await sendEmail(EMAILJS_LOOKING_ALTERNATE_TEMPLATE_ID, templateParams);
    console.log('📧 "Looking for alternate" email sent to client:', booking.customer_email);
    return result;

  } catch (error) {
    console.error('❌ Error sending "looking for alternate" email:', error);
    return { success: false, error: error.message };
  }
}

async function sendClientDeclineEmail(booking) {
  try {
    let serviceName = 'Massage Service';
    if (booking.services && booking.services.name) {
      serviceName = booking.services.name;
    }

    const templateParams = {
      to_email: booking.customer_email,
      to_name: booking.first_name + ' ' + booking.last_name,
      customer_name: booking.first_name + ' ' + booking.last_name,
      booking_id: booking.booking_id,
      service: serviceName,
      duration: booking.duration_minutes + ' minutes',
      date_time: new Date(booking.booking_time).toLocaleString(),
      address: booking.address
    };

    const result = await sendEmail(EMAILJS_BOOKING_DECLINED_TEMPLATE_ID, templateParams);
    console.log('📧 Final decline email sent to client:', booking.customer_email);
    return result;

  } catch (error) {
    console.error('❌ Error sending final decline email:', error);
    return { success: false, error: error.message };
  }
}

async function sendTherapistBookingRequest(booking, therapist, timeoutMinutes) {
  try {
    // Generate Accept/Decline URLs
    const baseUrl = process.env.URL || 'https://your-site.netlify.app';
    const acceptUrl = baseUrl + '/.netlify/functions/booking-response?action=accept&booking=' + booking.booking_id + '&therapist=' + therapist.id;
    const declineUrl = baseUrl + '/.netlify/functions/booking-response?action=decline&booking=' + booking.booking_id + '&therapist=' + therapist.id;

    const templateParams = {
      to_email: therapist.email,
      to_name: therapist.first_name + ' ' + therapist.last_name,
      therapist_name: therapist.first_name + ' ' + therapist.last_name,
      booking_id: booking.booking_id,
      client_name: booking.first_name + ' ' + booking.last_name,
      client_phone: booking.customer_phone || 'Not provided',
      service_name: (booking.services && booking.services.name) ? booking.services.name : 'Massage Service',
      duration: booking.duration_minutes + ' minutes',
      booking_date: new Date(booking.booking_time).toLocaleDateString(),
      booking_time: new Date(booking.booking_time).toLocaleTimeString(),
      address: booking.address,
      business_name: booking.business_name || 'Private Residence',
      booking_type: booking.booking_type || 'Standard Booking',
      room_number: booking.room_number || 'N/A',
      booker_name: booking.booker_name || 'N/A',
      parking: booking.parking || 'Unknown',
      notes: booking.notes || 'No special notes',
      therapist_fee: booking.therapist_fee ? '$' + booking.therapist_fee.toFixed(2) : 'TBD',
      timeout_minutes: timeoutMinutes,
      accept_url: acceptUrl,
      decline_url: declineUrl
    };

    const result = await sendEmail(EMAILJS_THERAPIST_REQUEST_TEMPLATE_ID, templateParams);
    console.log('📧 Booking request sent to therapist:', therapist.email);
    return result;

  } catch (error) {
    console.error('❌ Error sending therapist booking request:', error);
    return { success: false, error: error.message };
  }
}

// Utility functions
async function updateBookingStatus(bookingId, status) {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({ 
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('booking_id', bookingId);

    if (error) {
      console.error('❌ Error updating booking', bookingId, 'status:', error);
    } else {
      console.log('✅ Updated booking', bookingId, 'status to:', status);
    }
  } catch (error) {
    console.error('❌ Error updating booking status:', error);
  }
}

async function addStatusHistory(bookingId, status, userId, notes) {
  try {
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: bookingId,
        status: status,
        changed_by: userId,
        changed_at: new Date().toISOString(),
        notes: notes || null
      });
  } catch (error) {
    console.error('❌ Error adding status history:', error);
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function sendEmail(templateId, templateParams) {
  try {
    if (!EMAILJS_PRIVATE_KEY) {
      console.warn('⚠️ No private key found for EmailJS');
      return { success: false, error: 'Private key required' };
    }
    
    const emailData = {
      service_id: EMAILJS_SERVICE_ID,
      template_id: templateId,
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: EMAILJS_PRIVATE_KEY,
      template_params: templateParams
    };

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(emailData)
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('❌ EmailJS API error:', response.status, responseText);
      return { success: false, error: 'EmailJS error: ' + response.status };
    }

    return { success: true, response: responseText };

  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
}
