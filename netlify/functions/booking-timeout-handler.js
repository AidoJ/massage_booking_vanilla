const { createClient } = require('@supabase/supabase-js');

/*
 * FIXED Automatic Booking Timeout Handler
 * 
 * Prevents infinite loops by:
 * 1. Only processing each booking once per timeout stage
 * 2. Proper status tracking
 * 3. Adding timeout tracking fields
 */

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

    const timeoutMinutes = timeoutSetting?.value ? parseInt(timeoutSetting.value) : 60;
    console.log(`⏰ Using timeout: ${timeoutMinutes} minutes`);

    // Find bookings that need timeout processing
    const bookingsToProcess = await findBookingsNeedingTimeout(timeoutMinutes);
    console.log(`📊 Found ${bookingsToProcess.length} bookings needing timeout processing`);

    if (bookingsToProcess.length === 0) {
      console.log('✅ No bookings need timeout processing');
      return { statusCode: 200, body: 'No timeouts to process' };
    }

    // Process each booking
    const results = [];
    for (const booking of bookingsToProcess) {
      console.log(`🔄 Processing booking: ${booking.booking_id}, status: ${booking.status}`);
      const result = await processBookingTimeout(booking, timeoutMinutes);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Processed ${successCount}/${results.length} bookings successfully`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Processed ${successCount}/${results.length} bookings`,
        results
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

// FIXED: Find bookings that need timeout processing (prevents infinite loops)
async function findBookingsNeedingTimeout(timeoutMinutes) {
  try {
    const now = new Date();
    const firstTimeoutCutoff = new Date(now.getTime() - timeoutMinutes * 60 * 1000);
    const secondTimeoutCutoff = new Date(now.getTime() - (timeoutMinutes * 2) * 60 * 1000);
    
    console.log('🔍 Looking for bookings needing timeout processing...');
    console.log('📅 First timeout cutoff:', firstTimeoutCutoff.toISOString());
    console.log('📅 Second timeout cutoff:', secondTimeoutCutoff.toISOString());

    // Find bookings for FIRST timeout (status = 'requested' and past first timeout)
    const { data: firstTimeoutBookings, error: error1 } = await supabase
      .from('bookings')
      .select(`
        *,
        services(id, name),
        customers(id, first_name, last_name, email, phone),
        therapist_profiles!therapist_id(id, first_name, last_name, email)
      `)
      .eq('status', 'requested')
      .lt('created_at', firstTimeoutCutoff.toISOString());

    if (error1) {
      console.error('❌ Error fetching first timeout bookings:', error1);
    }

    // Find bookings for SECOND timeout (status = 'timeout_reassigned' and past second timeout)
    const { data: secondTimeoutBookings, error: error2 } = await supabase
      .from('bookings')
      .select(`
        *,
        services(id, name),
        customers(id, first_name, last_name, email, phone),
        therapist_profiles!therapist_id(id, first_name, last_name, email)
      `)
      .eq('status', 'timeout_reassigned')
      .lt('created_at', secondTimeoutCutoff.toISOString());

    if (error2) {
      console.error('❌ Error fetching second timeout bookings:', error2);
    }

    const allBookings = [
      ...(firstTimeoutBookings || []).map(b => ({ ...b, timeoutStage: 'first' })),
      ...(secondTimeoutBookings || []).map(b => ({ ...b, timeoutStage: 'second' }))
    ];

    console.log(`📊 Found ${firstTimeoutBookings?.length || 0} first timeout + ${secondTimeoutBookings?.length || 0} second timeout bookings`);
    
    return allBookings;

  } catch (error) {
    console.error('❌ Error finding timeout bookings:', error);
    return [];
  }
}

// Process a single booking timeout
async function processBookingTimeout(booking, timeoutMinutes) {
  try {
    console.log(`⚡ Processing ${booking.timeoutStage} timeout for booking ${booking.booking_id}`);
    
    if (booking.timeoutStage === 'first') {
      return await handleFirstTimeout(booking, timeoutMinutes);
    } else if (booking.timeoutStage === 'second') {
      return await handleSecondTimeout(booking);
    } else {
      console.log(`⚠️ Unknown timeout stage for booking ${booking.booking_id}`);
      return { success: false, booking_id: booking.booking_id, reason: 'Unknown timeout stage' };
    }

  } catch (error) {
    console.error(`❌ Error processing booking ${booking.booking_id}:`, error);
    return { success: false, booking_id: booking.booking_id, error: error.message };
  }
}

// Handle first timeout - reassign to all available therapists  
async function handleFirstTimeout(booking, timeoutMinutes) {
  try {
    console.log(`🔄 First timeout for booking ${booking.booking_id}`);

    // 1. Send "looking for alternate" email to client FIRST
    await sendClientLookingForAlternateEmail(booking);

    // 2. Find ALL available therapists in the geolocated area
    const availableTherapists = await findAllAvailableTherapists(booking);
    
    if (availableTherapists.length === 0) {
      console.log(`❌ No alternative therapists found for ${booking.booking_id} - declining immediately`);
      await sendClientDeclineEmail(booking);
      await updateBookingStatus(booking.booking_id, 'declined');
      await addStatusHistory(booking.id, 'declined', null, 'Automatic timeout - no available therapists');
      return { success: true, booking_id: booking.booking_id, action: 'declined_no_alternatives' };
    }

    // 3. CRITICAL: Update booking status to prevent reprocessing
    await updateBookingStatus(booking.booking_id, 'timeout_reassigned');
    await addStatusHistory(booking.id, 'timeout_reassigned', null, `Reassigned to ${availableTherapists.length} therapists after timeout`);

    // 4. Send booking requests to ALL available therapists  
    const emailResults = await sendBookingRequestsToMultipleTherapists(booking, availableTherapists, timeoutMinutes);
    
    console.log(`📧 Sent booking requests to ${availableTherapists.length} therapists`);
    console.log(`✅ Email success rate: ${emailResults.filter(r => r.success).length}/${emailResults.length}`);

    return {
      success: true,
      booking_id: booking.booking_id,
      action: 'reassigned_to_multiple',
      therapist_count: availableTherapists.length,
      email_results: emailResults
    };

  } catch (error) {
    console.error(`❌ Error in first timeout for ${booking.booking_id}:`, error);
    return { success: false, booking_id: booking.booking_id, error: error.message };
  }
}

// Handle second timeout - final decline
async function handleSecondTimeout(booking) {
  try {
    console.log(`⏰ Second timeout for booking ${booking.booking_id} - sending final decline`);

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
    console.error(`❌ Error in second timeout for ${booking.booking_id}:`, error);
    return { success: false, booking_id: booking.booking_id, error: error.message };
  }
}

// Find all available therapists for a booking
async function findAllAvailableTherapists(booking) {
  try {
    console.log(`🔍 Finding available therapists for ${booking.booking_id}`);

    // Get therapists who provide this service
    const { data: therapistLinks } = await supabase
      .from('therapist_services')
      .select(`
        therapist_id,
        therapist_profiles!therapist_id (
          id, first_name, last_name, email, gender, is_active,
          latitude, longitude, service_radius_km
        )
      `)
      .eq('service_id', booking.service_id);

    let availableTherapists = (therapistLinks || [])
      .map(row => row.therapist_profiles)
      .filter(t => t && t.is_active);

    console.log(`📊 Found ${availableTherapists.length} therapists who provide this service`);

    // Filter by gender preference
    if (booking.gender_preference && booking.gender_preference !== 'any') {
      availableTherapists = availableTherapists.filter(t => t.gender === booking.gender_preference);
      console.log(`📊 After gender filter: ${availableTherapists.length} therapists`);
    }

    // Filter by location (geolocated area from original booking)
    if (booking.latitude && booking.longitude) {
      availableTherapists = availableTherapists.filter(t => {
        if (!t.latitude || !t.longitude || !t.service_radius_km) return false;
        const distance = calculateDistance(
          booking.latitude, booking.longitude,
          t.latitude, t.longitude
        );
        return distance <= t.service_radius_km;
      });
      console.log(`📊 After location filter: ${availableTherapists.length} therapists`);
    }

    // Check availability for the specific time slot (simplified check)
    // Note: In a full implementation, you'd check actual availability
    // For now, we'll assume if they provide the service and are in area, they're available

    console.log(`📊 Final available therapists: ${availableTherapists.length}`);
    return availableTherapists;

  } catch (error) {
    console.error('❌ Error finding available therapists:', error);
    return [];
  }
}

// Send booking requests to multiple therapists
async function sendBookingRequestsToMultipleTherapists(booking, therapists, timeoutMinutes) {
  const results = [];
  
  for (const therapist of therapists) {
    try {
      console.log(`📧 Sending booking request to ${therapist.first_name} ${therapist.last_name} (${therapist.email})`);
      
      const result = await sendTherapistBookingRequest(booking, therapist, timeoutMinutes);
      results.push({
        therapist_id: therapist.id,
        therapist_name: `${therapist.first_name} ${therapist.last_name}`,
        success: result.success,
        error: result.error
      });
      
    } catch (error) {
      console.error(`❌ Error sending to ${therapist.first_name} ${therapist.last_name}:`, error);
      results.push({
        therapist_id: therapist.id,
        therapist_name: `${therapist.first_name} ${therapist.last_name}`,
        success: false,
        error: error.message
      });
    }
  }
  
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
      to_name: `${booking.first_name} ${booking.last_name}`,
      customer_name: `${booking.first_name} ${booking.last_name}`,
      booking_id: booking.booking_id,
      service: serviceName,
      duration: `${booking.duration_minutes} minutes`,
      date_time: new Date(booking.booking_time).toLocaleString(),
      address: booking.address
    };

    const result = await sendEmail(EMAILJS_LOOKING_ALTERNATE_TEMPLATE_ID, templateParams);
    console.log(`📧 "Looking for alternate" email sent to client: ${booking.customer_email}`);
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
      to_name: `${booking.first_name} ${booking.last_name}`,
      customer_name: `${booking.first_name} ${booking.last_name}`,
      booking_id: booking.booking_id,
      service: serviceName,
      duration: `${booking.duration_minutes} minutes`,
      date_time: new Date(booking.booking_time).toLocaleString(),
      address: booking.address
    };

    const result = await sendEmail(EMAILJS_BOOKING_DECLINED_TEMPLATE_ID, templateParams);
    console.log(`📧 Final decline email sent to client: ${booking.customer_email}`);
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
    const acceptUrl = `${baseUrl}/.netlify/functions/booking-response?action=accept&booking=${booking.booking_id}&therapist=${therapist.id}`;
    const declineUrl = `${baseUrl}/.netlify/functions/booking-response?action=decline&booking=${booking.booking_id}&therapist=${therapist.id}`;

    const templateParams = {
      to_email: therapist.email,
      to_name: `${therapist.first_name} ${therapist.last_name}`,
      therapist_name: `${therapist.first_name} ${therapist.last_name}`,
      booking_id: booking.booking_id,
      client_name: `${booking.first_name} ${booking.last_name}`,
      client_phone: booking.customer_phone || 'Not provided',
      service_name: booking.services?.name || 'Massage Service',
      duration: `${booking.duration_minutes} minutes`,
      booking_date: new Date(booking.booking_time).toLocaleDateString(),
      booking_time: new Date(booking.booking_time).toLocaleTimeString(),
      address: booking.address,
      business_name: booking.business_name || 'Private Residence',
      booking_type: booking.booking_type || 'Standard Booking',
      room_number: booking.room_number || 'N/A',
      booker_name: booking.booker_name || 'N/A',
      parking: booking.parking || 'Unknown',
      notes: booking.notes || 'No special notes',
      therapist_fee: booking.therapist_fee ? `$${booking.therapist_fee.toFixed(2)}` : 'TBD',
      timeout_minutes: timeoutMinutes,
      accept_url: acceptUrl,
      decline_url: declineUrl
    };

    const result = await sendEmail(EMAILJS_THERAPIST_REQUEST_TEMPLATE_ID, templateParams);
    console.log(`📧 Booking request sent to therapist: ${therapist.email}`);
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
        status,
        updated_at: new Date().toISOString()
      })
      .eq('booking_id', bookingId);

    if (error) {
      console.error(`❌ Error updating booking ${bookingId} status:`, error);
    } else {
      console.log(`✅ Updated booking ${bookingId} status to: ${status}`);
    }
  } catch (error) {
    console.error(`❌ Error updating booking status:`, error);
  }
}

async function addStatusHistory(bookingId, status, userId, notes = null) {
  try {
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: bookingId,
        status: status,
        changed_by: userId,
        changed_at: new Date().toISOString(),
        notes: notes
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
      return { success: false, error: `EmailJS error: ${response.status}` };
    }

    return { success: true, response: responseText };

  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
}
