// COMPLETE UPDATED booking-response.js file - SYNTAX CORRECTED
// Replace your entire netlify/functions/booking-response.js with this code

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://dcukfurezlkagvvwgsgr.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjdWtmdXJlemxrYWd2dndnc2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MjM0NjQsImV4cCI6MjA2NzQ5OTQ2NH0.ThXQKNHj0XpSkPa--ghmuRXFJ7nfcf0YVlH0liHofFw';
const supabase = createClient(supabaseUrl, supabaseKey);

// EmailJS configuration
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_puww2kb';
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID || 'template_ai9rrg6';
const EMAILJS_THERAPIST_REQUEST_TEMPLATE_ID = process.env.EMAILJS_THERAPIST_REQUEST_TEMPLATE_ID || 'template_51wt6of';
const EMAILJS_BOOKING_CONFIRMED_TEMPLATE_ID = process.env.EMAILJS_BOOKING_CONFIRMED_TEMPLATE_ID || 'template_confirmed';
const EMAILJS_THERAPIST_CONFIRMED_TEMPLATE_ID = process.env.EMAILJS_THERAPIST_CONFIRMED_TEMPLATE_ID || 'template_therapist_ok';
const EMAILJS_BOOKING_DECLINED_TEMPLATE_ID = process.env.EMAILJS_BOOKING_DECLINED_TEMPLATE_ID || 'template_declined';
const EMAILJS_LOOKING_ALTERNATE_TEMPLATE_ID = process.env.EMAILJS_LOOKING_ALTERNATE_TEMPLATE_ID || 'template_alternate';
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'qfM_qA664E4JddSMN';
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;

console.log('🔧 EmailJS Configuration:');
console.log('Service ID:', EMAILJS_SERVICE_ID);
console.log('Public Key:', EMAILJS_PUBLIC_KEY);
console.log('Private Key:', EMAILJS_PRIVATE_KEY ? '✅ Configured' : '❌ Missing');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'text/html; charset=utf-8'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const params = new URLSearchParams(event.rawQuery || '');
    const action = params.get('action');
    const bookingId = params.get('booking');
    const therapistId = params.get('therapist');

    console.log('📞 Booking response received:', { action, bookingId, therapistId });

    if (!action || !bookingId || !therapistId) {
      return {
        statusCode: 400,
        headers,
        body: generateErrorPage('Missing required parameters. Please contact support.')
      };
    }

    if (action !== 'accept' && action !== 'decline') {
      return {
        statusCode: 400,
        headers,
        body: generateErrorPage('Invalid action. Please contact support.')
      };
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, services(*), customers(*)')
      .eq('booking_id', bookingId)
      .single();

    if (bookingError || !booking) {
      console.error('❌ Error fetching booking:', bookingError);
      return {
        statusCode: 404,
        headers,
        body: generateErrorPage('Booking not found.')
      };
    }

    console.log('📋 Booking status:', booking.status, 'Original therapist:', booking.therapist_id, 'Responding therapist:', therapistId);

    // Verify therapist access based on booking status
    const canRespond = await verifyTherapistCanRespond(booking, therapistId);
    if (!canRespond.allowed) {
      return {
        statusCode: 403,
        headers,
        body: generateErrorPage(canRespond.reason)
      };
    }

    // Check if booking is available for response
    if (booking.status === 'confirmed') {
      return {
        statusCode: 409,
        headers,
        body: generateErrorPage('This booking has already been accepted by another therapist. Thank you for your interest.')
      };
    }

    if (booking.status === 'declined') {
      return {
        statusCode: 409,
        headers,
        body: generateErrorPage('This booking has already been declined. Thank you for your response.')
      };
    }

    // Allow responses for seeking_alternate status
    if (booking.status !== 'requested' && booking.status !== 'timeout_reassigned' && booking.status !== 'seeking_alternate') {
      return {
        statusCode: 409,
        headers,
        body: generateErrorPage('This booking has status: ' + booking.status + '. Cannot process response.')
      };
    }

    // Get therapist details
    const { data: therapist, error: therapistError } = await supabase
      .from('therapist_profiles')
      .select('id, first_name, last_name, email')
      .eq('id', therapistId)
      .single();

    if (therapistError || !therapist) {
      console.error('❌ Error fetching therapist:', therapistError);
      return {
        statusCode: 404,
        headers,
        body: generateErrorPage('Therapist not found.')
      };
    }

    // Process the response
    if (action === 'accept') {
      return await handleBookingAccept(booking, therapist, headers);
    } else {
      return await handleBookingDecline(booking, therapist, headers);
    }

  } catch (error) {
    console.error('❌ Error in booking response handler:', error);
    return {
      statusCode: 500,
      headers,
      body: generateErrorPage('An error occurred. Please contact support at 1300 302542.')
    };
  }
};

// Verify if therapist can respond to booking
async function verifyTherapistCanRespond(booking, therapistId) {
  try {
    // For regular bookings - only original therapist can respond
    if (booking.status === 'requested') {
      if (booking.therapist_id === therapistId) {
        return { allowed: true };
      } else {
        return { 
          allowed: false, 
          reason: 'This booking request was not assigned to you.' 
        };
      }
    }

    // For seeking_alternate, timeout_reassigned status - check if therapist provides service and is in area
    if (booking.status === 'seeking_alternate' || booking.status === 'timeout_reassigned') {
      console.log('🔍 Checking if therapist can respond to alternate booking...');
      
      // Check if therapist provides this service
      const { data: serviceLink } = await supabase
        .from('therapist_services')
        .select('therapist_id')
        .eq('therapist_id', therapistId)
        .eq('service_id', booking.service_id)
        .single();

      if (!serviceLink) {
        return { 
          allowed: false, 
          reason: 'You do not provide this service.' 
        };
      }

      // Check if therapist is in the service area (if location data available)
      if (booking.latitude && booking.longitude) {
        const { data: therapistData } = await supabase
          .from('therapist_profiles')
          .select('latitude, longitude, service_radius_km')
          .eq('id', therapistId)
          .single();

        if (therapistData && therapistData.latitude && therapistData.longitude && therapistData.service_radius_km) {
          const distance = calculateDistance(
            booking.latitude, booking.longitude,
            therapistData.latitude, therapistData.longitude
          );
          
          if (distance > therapistData.service_radius_km) {
            return { 
              allowed: false, 
              reason: 'This booking is outside your service area.' 
            };
          }
        }
      }

      console.log('✅ Therapist authorized for alternate booking');
      return { allowed: true };
    }

    return { 
      allowed: false, 
      reason: 'Booking status does not allow responses.' 
    };

  } catch (error) {
    console.error('❌ Error verifying therapist access:', error);
    return { 
      allowed: false, 
      reason: 'Error verifying access. Please contact support.' 
    };
  }
}

// Handle booking acceptance
async function handleBookingAccept(booking, therapist, headers) {
  try {
    console.log('✅ Processing booking acceptance:', booking.booking_id, 'by', therapist.first_name, therapist.last_name);

    // Update both therapist_id and responding_therapist_id
    const acceptUpdateData = {
      status: 'confirmed',
      therapist_id: therapist.id,
      therapist_response_time: new Date().toISOString(),
      responding_therapist_id: therapist.id,
      updated_at: new Date().toISOString()
    };

    console.log('📝 Updating booking with data:', JSON.stringify(acceptUpdateData, null, 2));

    const { error: updateError } = await supabase
      .from('bookings')
      .update(acceptUpdateData)
      .eq('booking_id', booking.booking_id);

    if (updateError) {
      console.error('❌ Error updating booking status:', updateError);
      throw new Error('Failed to confirm booking');
    }

    console.log('✅ Booking status updated successfully');

    // Add status history
    try {
      const historyNote = (booking.status === 'timeout_reassigned' || booking.status === 'seeking_alternate') ? 
        'Accepted by alternate therapist' : 
        'Accepted by original therapist';
      await addStatusHistory(booking.id, 'confirmed', therapist.id, historyNote);
      console.log('✅ Status history added');
    } catch (historyError) {
      console.error('❌ Error adding status history:', historyError);
    }

    // Send confirmation emails
    console.log('📧 Starting to send confirmation emails...');
    
    try {
      await sendClientConfirmationEmail(booking, therapist);
      console.log('✅ Client confirmation email sent successfully');
    } catch (emailError) {
      console.error('❌ Error sending client confirmation email:', emailError);
    }

    try {
      await sendTherapistConfirmationEmail(booking, therapist);
      console.log('✅ Therapist confirmation email sent successfully');
    } catch (emailError) {
      console.error('❌ Error sending therapist confirmation email:', emailError);
    }

    // Get service name for display
    let serviceName = 'Massage Service';
    if (booking.services && booking.services.name) {
      serviceName = booking.services.name;
    }

    const wasAlternate = (booking.status === 'timeout_reassigned' || booking.status === 'seeking_alternate');
    const successMessage = wasAlternate ?
      'Thank you ' + therapist.first_name + '! You have successfully accepted this alternate booking ' + booking.booking_id + '.' :
      'Thank you ' + therapist.first_name + '! You have successfully accepted booking ' + booking.booking_id + '.';

    return {
      statusCode: 200,
      headers,
      body: generateSuccessPage(
        'Booking Accepted Successfully!',
        successMessage,
        [
          'Client: ' + booking.first_name + ' ' + booking.last_name,
          'Service: ' + serviceName,
          'Date: ' + new Date(booking.booking_time).toLocaleString(),
          'Location: ' + booking.address,
          'Room: ' + (booking.room_number || 'N/A'),
          'Your Fee: $' + (booking.therapist_fee || 'TBD')
        ]
      )
    };

  } catch (error) {
    console.error('❌ Error handling booking acceptance:', error);
    return {
      statusCode: 500,
      headers,
      body: generateErrorPage('Error confirming booking. Please contact support immediately at 1300 302542.')
    };
  }
}

// Handle booking decline with multiple therapist approach
async function handleBookingDecline(booking, therapist, headers) {
  try {
    console.log('❌ Processing booking decline:', booking.booking_id, 'by', therapist.first_name, therapist.last_name);

    // If this is a timeout_reassigned or seeking_alternate booking, just record the decline
    if (booking.status === 'timeout_reassigned' || booking.status === 'seeking_alternate') {
      console.log('📝 Recording decline for alternate booking - other therapists can still respond');
      
      await addStatusHistory(booking.id, 'therapist_declined', therapist.id, 
        therapist.first_name + ' ' + therapist.last_name + ' declined alternate booking');

      return {
        statusCode: 200,
        headers,
        body: generateSuccessPage(
          'Response Recorded',
          'Thank you for your response, ' + therapist.first_name + '. Your decline has been recorded. Other therapists may still accept this booking.',
          [
            'Booking: ' + booking.booking_id,
            'Client: ' + booking.first_name + ' ' + booking.last_name
          ]
        )
      };
    }

    // Original booking decline logic - use multiple therapist approach
    if (booking.fallback_option === 'yes') {
      console.log('🔍 Customer wants alternatives - finding ALL available therapists for', booking.booking_id);
      
      // Find ALL available alternative therapists
      const availableTherapists = await findAllAvailableTherapists(booking, therapist.id);
      
      if (availableTherapists.length > 0) {
        console.log('✅ Found', availableTherapists.length, 'alternative therapists');
        
        // 1. FIRST: Send "Looking for Alternate" email to customer
        await sendClientLookingForAlternateEmail(booking);
        
        // 2. Update booking status to prevent reprocessing
        await updateBookingStatus(booking.booking_id, 'seeking_alternate');
        await addStatusHistory(booking.id, 'seeking_alternate', therapist.id, 
          therapist.first_name + ' ' + therapist.last_name + ' declined - searching ' + availableTherapists.length + ' alternatives');
        
        // 3. Send booking requests to ALL available therapists
        const { data: timeoutSetting } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'therapist_response_timeout_minutes')
          .single();
        const timeoutMinutes = timeoutSetting && timeoutSetting.value ? parseInt(timeoutSetting.value) : 60;
        
        const emailResults = await sendBookingRequestsToMultipleTherapists(booking, availableTherapists, timeoutMinutes);
        console.log('📧 Sent requests to', availableTherapists.length, 'therapists');
        
        return {
          statusCode: 200,
          headers,
          body: generateSuccessPage(
            'Booking Declined - Alternatives Found',
            'Thank you for your response, ' + therapist.first_name + '. We found ' + availableTherapists.length + ' alternative therapists and are contacting them now.',
            [
              'Booking: ' + booking.booking_id,
              'Client: ' + booking.first_name + ' ' + booking.last_name,
              availableTherapists.length + ' alternative therapists contacted',
              'Customer has been notified we are looking for alternatives'
            ]
          )
        };
      } else {
        console.log('❌ No alternative therapists found for', booking.booking_id);
      }
    }

    // No alternative found or customer didn't want fallback - send decline
    console.log('📧 Sending final decline email to customer for', booking.booking_id);
    
    const declineUpdateData = {
      status: 'declined',
      therapist_response_time: new Date().toISOString(),
      responding_therapist_id: therapist.id,
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('bookings')
      .update(declineUpdateData)
      .eq('booking_id', booking.booking_id);

    if (updateError) {
      console.error('❌ Error updating booking status to declined:', updateError);
      throw new Error('Failed to decline booking');
    }

    await addStatusHistory(booking.id, 'declined', therapist.id, 'No alternatives available or customer declined fallback');
    await sendClientDeclineEmail(booking);

    return {
      statusCode: 200,
      headers,
      body: generateSuccessPage(
        'Booking Declined',
        'Thank you for your response, ' + therapist.first_name + '. The booking has been declined and the client has been notified.',
        [
          'Booking: ' + booking.booking_id,
          'Client: ' + booking.first_name + ' ' + booking.last_name,
          'Client has been notified of the decline.'
        ]
      )
    };

  } catch (error) {
    console.error('❌ Error handling booking decline:', error);
    return {
      statusCode: 500,
      headers,
      body: generateErrorPage('Error processing decline. Please contact support at 1300 302542.')
    };
  }
}

// UPDATED: booking-response.js - Fixed to check actual time slot availability
// Replace the findAllAvailableTherapists function in your booking-response.js with this version:

// FIXED: Find all available therapists for a booking (checks actual time slot availability)
async function findAllAvailableTherapists(booking, excludeTherapistId) {
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

    // NEW: Filter by actual time slot availability
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
        // Skip this therapist if there's an error checking availability
        continue;
      }
    }

    // Remove duplicates by ID (just in case)
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

// Helper function to update booking status
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
      throw error;
    } else {
      console.log('✅ Updated booking', bookingId, 'status to:', status);
    }
  } catch (error) {
    console.error('❌ Error updating booking status:', error);
    throw error;
  }
}

// Email functions
async function sendClientConfirmationEmail(booking, therapist) {
  try {
    console.log('📧 Preparing client confirmation email...');

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
      address: booking.address,
      room_number: booking.room_number || 'N/A',
      therapist: therapist.first_name + ' ' + therapist.last_name,
      estimated_price: booking.price ? '$' + booking.price.toFixed(2) : 'N/A'
    };

    const result = await sendEmail(EMAILJS_BOOKING_CONFIRMED_TEMPLATE_ID, templateParams);
    return result;

  } catch (error) {
    console.error('❌ Error in sendClientConfirmationEmail:', error);
    throw error;
  }
}

async function sendTherapistConfirmationEmail(booking, therapist) {
  try {
    console.log('📧 Preparing therapist confirmation email...');

    let serviceName = 'Massage Service';
    if (booking.services && booking.services.name) {
      serviceName = booking.services.name;
    }

    const templateParams = {
      to_email: therapist.email,
      to_name: therapist.first_name + ' ' + therapist.last_name,
      therapist_name: therapist.first_name + ' ' + therapist.last_name,
      booking_id: booking.booking_id,
      client_name: booking.first_name + ' ' + booking.last_name,
      client_phone: booking.customer_phone || 'Not provided',
      client_email: booking.customer_email,
      service_name: serviceName,
      duration: booking.duration_minutes + ' minutes',
      booking_date: new Date(booking.booking_time).toLocaleDateString(),
      booking_time: new Date(booking.booking_time).toLocaleTimeString(),
      address: booking.address,
      room_number: booking.room_number || 'N/A',
      therapist_fee: booking.therapist_fee ? '$' + booking.therapist_fee.toFixed(2) : 'TBD'
    };

    const result = await sendEmail(EMAILJS_THERAPIST_CONFIRMED_TEMPLATE_ID, templateParams);
    return result;

  } catch (error) {
    console.error('❌ Error in sendTherapistConfirmationEmail:', error);
    throw error;
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

    await sendEmail(EMAILJS_BOOKING_DECLINED_TEMPLATE_ID, templateParams);
    console.log('📧 Decline email sent to client:', booking.customer_email);

  } catch (error) {
    console.error('❌ Error sending client decline email:', error);
  }
}

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

    await sendEmail(EMAILJS_LOOKING_ALTERNATE_TEMPLATE_ID, templateParams);
    console.log('📧 "Looking for alternate" email sent to client:', booking.customer_email);

  } catch (error) {
    console.error('❌ Error sending "looking for alternate" email:', error);
  }
}

async function sendTherapistBookingRequest(booking, therapist, timeoutMinutes) {
  try {
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

// Helper functions
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
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

// HTML page generators
function generateSuccessPage(title, message, details) {
  details = details || [];
  
  const detailsHtml = details.length > 0 ? 
    '<div class="details"><h3>Booking Details:</h3>' + 
    details.map(detail => '<p>' + detail + '</p>').join('') + 
    '</div>' : '';

  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>' + title + '</title><style>@import url("https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400;500;600;700&display=swap");body{font-family:"Josefin Sans",sans-serif;background:linear-gradient(135deg,#007e8c 0%,#00a676 100%);margin:0;padding:40px 20px;min-height:100vh;display:flex;align-items:center;justify-content:center}.container{background:white;border-radius:16px;padding:40px;max-width:500px;width:100%;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,0.1)}.success-icon{font-size:4rem;margin-bottom:20px}h1{color:#007e8c;font-size:2rem;margin-bottom:16px;font-weight:700}.message{color:#4a6166;font-size:1.1rem;line-height:1.6;margin-bottom:30px}.details{background:#f8feff;border-radius:12px;padding:20px;margin-bottom:30px;text-align:left}.details h3{color:#007e8c;margin-bottom:15px;font-size:1.1rem}.details p{color:#4a6166;margin:8px 0;font-size:0.95rem}.footer{color:#7a9199;font-size:0.9rem}</style></head><body><div class="container"><div class="success-icon">✅</div><h1>' + title + '</h1><div class="message">' + message + '</div>' + detailsHtml + '<div class="footer">You can safely close this window.<br><strong>Rejuvenators Mobile Massage</strong></div></div></body></html>';
}

function generateErrorPage(message) {
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Error - Booking Response</title><style>@import url("https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400;500;600;700&display=swap");body{font-family:"Josefin Sans",sans-serif;background:linear-gradient(135deg,#dc3545 0%,#c82333 100%);margin:0;padding:40px 20px;min-height:100vh;display:flex;align-items:center;justify-content:center}.container{background:white;border-radius:16px;padding:40px;max-width:500px;width:100%;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,0.1)}.error-icon{font-size:4rem;margin-bottom:20px}h1{color:#dc3545;font-size:2rem;margin-bottom:16px;font-weight:700}.message{color:#4a6166;font-size:1.1rem;line-height:1.6;margin-bottom:30px}.contact-info{background:#f8f9fa;border-radius:12px;padding:20px;margin-bottom:30px}.contact-info h3{color:#007e8c;margin-bottom:10px}.contact-info p{color:#4a6166;margin:5px 0}.footer{color:#7a9199;font-size:0.9rem}</style></head><body><div class="container"><div class="error-icon">❌</div><h1>Unable to Process Request</h1><div class="message">' + message + '</div><div class="contact-info"><h3>Need Help?</h3><p><strong>Call:</strong> 1300 302542</p><p><strong>Email:</strong> info@rejuvenators.com</p></div><div class="footer"><strong>Rejuvenators Mobile Massage</strong><br>We are here to help resolve any issues.</div></div></body></html>';
}
