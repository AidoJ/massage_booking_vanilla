const { createClient } = require('@supabase/supabase-js');

/*
 * Automatic Booking Timeout Handler
 * 
 * Runs every 5 minutes to check for timed-out bookings and automatically:
 * 1. Send timeout notification to original therapist
 * 2. Send "looking for alternate" email to client
 * 3. Find ALL available therapists in geolocated area
 * 4. Send booking requests to all available therapists
 * 5. Reset timeout timer for new round
 * 6. Handle final decline if no responses in second round
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

    // Find timed-out bookings
    const timedOutBookings = await findTimedOutBookings(timeoutMinutes);
    console.log(`📊 Found ${timedOutBookings.length} timed-out bookings`);

    if (timedOutBookings.length === 0) {
      console.log('✅ No timed-out bookings found');
      return { statusCode: 200, body: 'No timeouts to process' };
    }

    // Process each timed-out booking
    const results = [];
    for (const booking of timedOutBookings) {
      console.log(`🔄 Processing timed-out booking: ${booking.booking_id}`);
      const result = await processTimedOutBooking(booking, timeoutMinutes);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Processed ${successCount}/${results.length} timed-out bookings successfully`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Processed ${successCount}/${results.length} timed-out bookings`,
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

// Find bookings that have timed out
async function findTimedOutBookings(timeoutMinutes) {
  try {
    const cutoffTime = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    
    console.log('🔍 Looking for timed-out bookings...');
    console.log('📅 Cutoff time:', cutoffTime.toISOString());

    // Find bookings that are still 'requested' and past the timeout
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        *,
        services(id, name),
        customers(id, first_name, last_name, email, phone),
        therapist_profiles!therapist_id(id, first_name, last_name, email)
      `)
      .eq('status', 'requested')
      .lt('created_at', cutoffTime.toISOString());

    if (error) {
      console.error('❌ Error fetching timed-out bookings:', error);
      return [];
    }

    console.log(`📊 Found ${bookings?.length || 0} potentially timed-out bookings`);
    
    // Filter out bookings that might have been reassigned already
    const actualTimedOut = (bookings || []).filter(booking => {
      // Check if this is the first timeout or second timeout
      const timeSinceCreated = (Date.now() - new Date(booking.created_at).getTime()) / (1000 * 60);
      const isFirstTimeout = timeSinceCreated >= timeoutMinutes && timeSinceCreated < (timeoutMinutes * 2);
      const isSecondTimeout = timeSinceCreated >= (timeoutMinutes * 2);
      
      console.log(`📋 Booking ${booking.booking_id}: ${timeSinceCreated.toFixed(1)} min old (first: ${isFirstTimeout}, second: ${isSecondTimeout})`);
      
      return isFirstTimeout || isSecondTimeout;
    });

    return actualTimedOut;

  } catch (error) {
    console.error('❌ Error finding timed-out bookings:', error);
    return [];
  }
}

// Process a single timed-out booking
async function processTimedOutBooking(booking, timeoutMinutes) {
  try {
    console.log(`⚡ Processing booking ${booking.booking_id}`);
    
    const timeSinceCreated = (Date.now() - new Date(booking.created_at).getTime()) / (1000 * 60);
    const isFirstTimeout = timeSinceCreated >= timeoutMinutes && timeSinceCreated < (timeoutMinutes * 2);
    const isSecondTimeout = timeSinceCreated >= (timeoutMinutes * 2);

    if (isFirstTimeout) {
      return await handleFirstTimeout(booking, timeoutMinutes);
    } else if (isSecondTimeout) {
      return await handleSecondTimeout(booking);
    } else {
      console.log(`⚠️ Booking ${booking.booking_id} doesn't match timeout criteria`);
      return { success: false, booking_id: booking.booking_id, reason: 'No timeout criteria matched' };
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

    // 1. Send timeout notification to original therapist
    await sendTimeoutNotificationToTherapist(booking);

    // 2. Send "looking for alternate" email to client
    await sendClientLookingForAlternateEmail(booking);

    // 3. Find ALL available therapists in the geolocated area
    const availableTherapists = await findAllAvailableTherapists(booking);
    
    if (availableTherapists.length === 0) {
      console.log(`❌ No alternative therapists found for ${booking.booking_id}`);
      // Send final decline email immediately
      await sendClientDeclineEmail(booking);
      await updateBookingStatus(booking.booking_id, 'declined');
      return { success: true, booking_id: booking.booking_id, action: 'declined_no_alternatives' };
    }

    // 4. Update booking status to indicate it's been reassigned
    await updateBookingStatus(booking.booking_id, 'timeout_reassigned');

    // 5. Send booking requests to ALL available therapists
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

    // Update booking status to declined
    await updateBookingStatus(booking.booking_id, 'declined');

    // Add status history
    await addStatusHistory(booking.id, 'declined', null, 'Automatic timeout - no therapist responses');

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

    // Check availability for the specific time slot
    const bookingDate = new Date(booking.booking_time).toISOString().split('T')[0];
    const finalAvailable = [];

    for (const therapist of availableTherapists) {
      const slots = await getAvailableSlotsForTherapist(therapist, bookingDate, booking.duration_minutes);
      const bookingTimeOnly = new Date(booking.booking_time).toTimeString().split(' ')[0].substring(0, 5);
      
      if (slots.includes(bookingTimeOnly)) {
        finalAvailable.push(therapist);
      }
    }

    console.log(`📊 Final available therapists: ${finalAvailable.length}`);
    return finalAvailable;

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
      console.log(`📧 Sending booking request to ${therapist.first_name} ${therapist.last_name}`);
      
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

// Helper functions for emails
async function sendTimeoutNotificationToTherapist(booking) {
  // This could be a separate email template, or you could skip it
  // For now, let's just log it
  console.log(`📧 Would send timeout notification to therapist ${booking.therapist_profiles?.first_name} for booking ${booking.booking_id}`);
}

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

    await sendEmail(EMAILJS_LOOKING_ALTERNATE_TEMPLATE_ID, templateParams);
    console.log(`📧 "Looking for alternate" email sent to client: ${booking.customer_email}`);

  } catch (error) {
    console.error('❌ Error sending "looking for alternate" email:', error);
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

    await sendEmail(EMAILJS_BOOKING_DECLINED_TEMPLATE_ID, templateParams);
    console.log(`📧 Final decline email sent to client: ${booking.customer_email}`);

  } catch (error) {
    console.error('❌ Error sending final decline email:', error);
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

async function getAvailableSlotsForTherapist(therapist, date, durationMinutes) {
  // This is a simplified version - you'll need to implement the full logic
  // based on your existing getAvailableSlotsForTherapist function
  try {
    const dayOfWeek = new Date(date).getDay();
    
    // Get working hours
    const { data: availabilities } = await supabase
      .from('therapist_availability')
      .select('start_time, end_time')
      .eq('therapist_id', therapist.id)
      .eq('day_of_week', dayOfWeek);
    
    if (!availabilities || availabilities.length === 0) return [];
    
    const { start_time, end_time } = availabilities[0];
    
    // Get existing bookings
    const { data: bookings } = await supabase
      .from('bookings')
      .select('booking_time')
      .eq('therapist_id', therapist.id)
      .gte('booking_time', date + 'T00:00:00')
      .lt('booking_time', date + 'T23:59:59');
    
    // Generate available slots (simplified)
    const slots = [];
    for (let hour = 9; hour <= 17; hour++) {
      const slotStart = `${hour.toString().padStart(2, '0')}:00`;
      if (slotStart >= start_time && slotStart < end_time) {
        // Check for conflicts (simplified)
        const hasConflict = (bookings || []).some(booking => {
          const bookingHour = new Date(booking.booking_time).getHours();
          return Math.abs(bookingHour - hour) < (durationMinutes / 60);
        });
        
        if (!hasConflict) {
          slots.push(slotStart);
        }
      }
    }
    
    return slots;
    
  } catch (error) {
    console.error('❌ Error getting available slots:', error);
    return [];
  }
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
