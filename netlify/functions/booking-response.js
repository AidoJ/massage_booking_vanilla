const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
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

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'text/html; charset=utf-8'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Parse query parameters - UPDATED to match your email URL format
    const params = new URLSearchParams(event.rawQuery || '');
    const action = params.get('action'); // 'accept' or 'decline'
    const bookingId = params.get('booking'); // booking_id string like 'RMM202501-0001'
    const therapistId = params.get('therapist'); // therapist UUID

    console.log('📞 Booking response received:', { action, bookingId, therapistId });

    // Validate required parameters
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

    // Get booking details - UPDATED to use booking_id field (not id)
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        services(*),
        customers(*)
      `)
      .eq('booking_id', bookingId) // Use booking_id field, not id
      .single();

    if (bookingError || !booking) {
      console.error('❌ Error fetching booking:', bookingError);
      return {
        statusCode: 404,
        headers,
        body: generateErrorPage('Booking not found. It may have already been processed.')
      };
    }

    // Verify therapist ID matches
    if (booking.therapist_id !== therapistId) {
      return {
        statusCode: 403,
        headers,
        body: generateErrorPage('This booking request was not assigned to you.')
      };
    }

    // Check if booking is still pending
    if (booking.status !== 'requested') {
      return {
        statusCode: 409,
        headers,
        body: generateErrorPage(`This booking has already been ${booking.status}. Thank you for your response.`)
      };
    }

    // Check if response is within timeout window - UPDATED to use system_settings
    const { data: timeoutSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'therapist_response_timeout_minutes')
      .single();

    const timeoutMinutes = timeoutSetting?.value ? parseInt(timeoutSetting.value) : 60;
    const bookingTime = new Date(booking.created_at);
    const now = new Date();
    const timeDiff = (now - bookingTime) / (1000 * 60); // minutes

    if (timeDiff > timeoutMinutes) {
      return {
        statusCode: 408,
        headers,
        body: generateErrorPage(`Response time expired. You had ${timeoutMinutes} minutes to respond.`)
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
        body: generateErrorPage('Therapist not found. Please contact support.')
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
      body: generateErrorPage('An error occurred processing your response. Please contact support at 1300 302542.')
    };
  }
};

// Handle booking acceptance
async function handleBookingAccept(booking, therapist, headers) {
  try {
    console.log(`✅ Processing booking acceptance: ${booking.booking_id} by ${therapist.first_name} ${therapist.last_name}`);

    // Update booking status
    const updateData = {
      status: 'confirmed',
      therapist_response_time: new Date().toISOString(),
      responding_therapist_id: therapist.id,
      updated_at: new Date().toISOString()
    };

    console.log('📝 Updating booking with data:', JSON.stringify(updateData, null, 2));

    const { error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('booking_id', booking.booking_id);

    if (updateError) {
      console.error('❌ Error updating booking status:', updateError);
      throw new Error('Failed to confirm booking');
    }

    console.log('✅ Booking status updated successfully');

    // Add status history record
    try {
      await addStatusHistory(booking.id, 'confirmed', therapist.id);
      console.log('✅ Status history added');
    } catch (historyError) {
      console.error('❌ Error adding status history:', historyError);
      // Don't fail the whole process for this
    }

    // Send confirmation emails (but don't fail if they don't send)
    console.log('📧 Starting to send confirmation emails...');
    
    let emailErrors = [];
    
    try {
      await sendClientConfirmationEmail(booking, therapist);
      console.log('✅ Client confirmation email sent successfully');
    } catch (clientEmailError) {
      console.error('❌ Error sending client confirmation email:', clientEmailError);
      emailErrors.push('Client confirmation email failed');
    }

    try {
      await sendTherapistConfirmationEmail(booking, therapist);
      console.log('✅ Therapist confirmation email sent successfully');
    } catch (therapistEmailError) {
      console.error('❌ Error sending therapist confirmation email:', therapistEmailError);
      emailErrors.push('Therapist confirmation email failed');
    }

    // Get service name for display
    const serviceName = booking.services?.name || 'Massage Service';

    // Return success page (even if emails failed)
    return {
      statusCode: 200,
      headers,
      body: generateSuccessPage(
        'Booking Accepted Successfully!',
        `Thank you ${therapist.first_name}! You have successfully accepted booking ${booking.booking_id}.`,
        [
          `Client: ${booking.first_name} ${booking.last_name}`,
          `Service: ${serviceName}`,
          `Date: ${new Date(booking.booking_time).toLocaleString()}`,
          `Location: ${booking.address}`,
          `Room: ${booking.room_number || 'N/A'}`,
          `Your Fee: $${booking.therapist_fee || 'TBD'}`,
          ...(emailErrors.length > 0 ? [`Note: ${emailErrors.join(', ')}`] : [])
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

// Handle booking decline
async function handleBookingDecline(booking, therapist, headers) {
  try {
    console.log(`❌ Processing booking decline: ${booking.booking_id} by ${therapist.first_name} ${therapist.last_name}`);

    // Check customer's fallback preference
    if (booking.fallback_option === 'yes') {
      // Try to find alternative therapist
      const alternativeFound = await findAndAssignAlternativeTherapist(booking, therapist.id);
      
      if (alternativeFound) {
        // Send "looking for alternate" email to client
        await sendClientLookingForAlternateEmail(booking);
        
        return {
          statusCode: 200,
          headers,
          body: generateSuccessPage(
            'Booking Declined - Alternative Found',
            `Thank you for your response, ${therapist.first_name}. We're contacting an alternative therapist for this booking.`,
            [
              `Booking: ${booking.booking_id}`,
              `Client: ${booking.first_name} ${booking.last_name}`,
              `An alternative therapist will be contacted shortly.`
            ]
          )
        };
      }
    }

    // No alternative found or customer didn't want fallback
    const updateData = {
      status: 'declined',
      therapist_response_time: new Date().toISOString(),
      responding_therapist_id: therapist.id,
      updated_at: new Date().toISOString()
    };

    const { error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('booking_id', booking.booking_id);

    if (updateError) {
      console.error('❌ Error updating booking status to declined:', updateError);
      throw new Error('Failed to decline booking');
    }

    // Add status history
    await addStatusHistory(booking.id, 'declined', therapist.id);

    // Send decline notification to client
    await sendClientDeclineEmail(booking);

    return {
      statusCode: 200,
      headers,
      body: generateSuccessPage(
        'Booking Declined',
        `Thank you for your response, ${therapist.first_name}. The booking has been declined and the client has been notified.`,
        [
          `Booking: ${booking.booking_id}`,
          `Client: ${booking.first_name} ${booking.last_name}`,
          `Client has been notified of the decline.`
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

// Enhanced alternative therapist finder
async function findAndAssignAlternativeTherapist(booking, excludeTherapistId) {
  try {
    console.log(`🔍 Looking for alternative therapist for booking ${booking.booking_id}`);

    // Get available therapists for the same service (excluding the declining therapist)
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
      .filter(t => t && t.is_active && t.id !== excludeTherapistId);

    // Filter by gender preference
    if (booking.gender_preference && booking.gender_preference !== 'any') {
      availableTherapists = availableTherapists.filter(t => t.gender === booking.gender_preference);
    }

    // Filter by location if coordinates available
    if (booking.latitude && booking.longitude) {
      availableTherapists = availableTherapists.filter(t => {
        if (!t.latitude || !t.longitude || !t.service_radius_km) return false;
        const distance = calculateDistance(
          booking.latitude, booking.longitude,
          t.latitude, t.longitude
        );
        return distance <= t.service_radius_km;
      });
    }

    if (availableTherapists.length === 0) {
      console.log(`❌ No alternative therapists found for booking ${booking.booking_id}`);
      return false;
    }

    // Select first available alternative
    const alternativeTherapist = availableTherapists[0];
    console.log(`✅ Found alternative: ${alternativeTherapist.first_name} ${alternativeTherapist.last_name}`);

    // Update booking with new therapist
    const { error: updateError } = await supabase
      .from('bookings')
      .update({ 
        therapist_id: alternativeTherapist.id,
        updated_at: new Date().toISOString()
      })
      .eq('booking_id', booking.booking_id);

    if (updateError) {
      console.error('❌ Error updating booking with alternative therapist:', updateError);
      return false;
    }

    // Get timeout setting
    const { data: timeoutSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'therapist_response_timeout_minutes')
      .single();

    const timeoutMinutes = timeoutSetting?.value ? parseInt(timeoutSetting.value) : 60;

    // Send booking request to alternative therapist
    await sendTherapistBookingRequest(booking, alternativeTherapist, timeoutMinutes);

    return true;

  } catch (error) {
    console.error('❌ Error finding alternative therapist:', error);
    return false;
  }
}

// Email sending functions
async function sendClientConfirmationEmail(booking, therapist) {
  try {
    console.log('📧 Starting client confirmation email...');
    console.log('📧 Booking data:', JSON.stringify(booking, null, 2));
    console.log('📧 Therapist data:', JSON.stringify(therapist, null, 2));

    const templateParams = {
      to_email: booking.customer_email,
      to_name: `${booking.first_name} ${booking.last_name}`,
      customer_name: `${booking.first_name} ${booking.last_name}`,
      booking_id: booking.booking_id,
      service: booking.services?.name || 'Massage Service',
      duration: `${booking.duration_minutes} minutes`,
      date_time: new Date(booking.booking_time).toLocaleString(),
      address: booking.address,
      room_number: booking.room_number || 'N/A',
      therapist: `${therapist.first_name} ${therapist.last_name}`,
      estimated_price: booking.price ? `$${booking.price.toFixed(2)}` : 'N/A'
    };

    console.log('📧 Client confirmation template params:', JSON.stringify(templateParams, null, 2));
    console.log('📧 Using template ID:', EMAILJS_BOOKING_CONFIRMED_TEMPLATE_ID);

    const result = await sendEmail(EMAILJS_BOOKING_CONFIRMED_TEMPLATE_ID, templateParams);
    console.log(`📧 Confirmation email sent to client: ${booking.customer_email}`, result);

  } catch (error) {
    console.error('❌ Error sending client confirmation email:', error);
    throw error;
  }
}

async function sendTherapistConfirmationEmail(booking, therapist) {
  try {
    console.log('📧 Starting therapist confirmation email...');
    console.log('📧 Booking data:', JSON.stringify(booking, null, 2));
    console.log('📧 Therapist data:', JSON.stringify(therapist, null, 2));

    const templateParams = {
      to_email: therapist.email,
      to_name: `${therapist.first_name} ${therapist.last_name}`,
      booking_id: booking.booking_id,
      client_name: `${booking.first_name} ${booking.last_name}`,
      client_phone: booking.customer_phone || 'Not provided',
      client_email: booking.customer_email,
      service_name: booking.services?.name || 'Massage Service',
      duration: `${booking.duration_minutes} minutes`,
      booking_date: new Date(booking.booking_time).toLocaleDateString(),
      booking_time: new Date(booking.booking_time).toLocaleTimeString(),
      address: booking.address,
      room_number: booking.room_number || 'N/A',
      therapist_fee: booking.therapist_fee ? `$${booking.therapist_fee.toFixed(2)}` : 'TBD'
    };

    console.log('📧 Therapist confirmation template params:', JSON.stringify(templateParams, null, 2));
    console.log('📧 Using template ID:', EMAILJS_THERAPIST_CONFIRMED_TEMPLATE_ID);

    const result = await sendEmail(EMAILJS_THERAPIST_CONFIRMED_TEMPLATE_ID, templateParams);
    console.log(`📧 Confirmation email sent to therapist: ${therapist.email}`, result);

  } catch (error) {
    console.error('❌ Error sending therapist confirmation email:', error);
    throw error;
  }
}

async function sendClientDeclineEmail(booking) {
  try {
    const templateParams = {
      to_email: booking.customer_email,
      to_name: `${booking.first_name} ${booking.last_name}`,
      customer_name: `${booking.first_name} ${booking.last_name}`,
      booking_id: booking.booking_id,
      service: booking.services?.name || 'Massage Service',
      duration: `${booking.duration_minutes} minutes`,
      date_time: new Date(booking.booking_time).toLocaleString(),
      address: booking.address
    };

    await sendEmail(EMAILJS_BOOKING_DECLINED_TEMPLATE_ID, templateParams);
    console.log(`📧 Decline email sent to client: ${booking.customer_email}`);

  } catch (error) {
    console.error('❌ Error sending client decline email:', error);
  }
}

async function sendClientLookingForAlternateEmail(booking) {
  try {
    const templateParams = {
      to_email: booking.customer_email,
      to_name: `${booking.first_name} ${booking.last_name}`,
      customer_name: `${booking.first_name} ${booking.last_name}`,
      booking_id: booking.booking_id,
      service: booking.services?.name || 'Massage Service',
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

    await sendEmail(EMAILJS_THERAPIST_REQUEST_TEMPLATE_ID, templateParams);
    console.log(`📧 Booking request sent to alternative therapist: ${therapist.email}`);

  } catch (error) {
    console.error('❌ Error sending therapist booking request:', error);
  }
}

// Helper functions
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

async function addStatusHistory(bookingId, status, userId) {
  try {
    await supabase
      .from('booking_status_history')
      .insert({
        booking_id: bookingId,
        status: status,
        changed_by: userId,
        changed_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('❌ Error adding status history:', error);
  }
}

// Helper function to send emails via EmailJS
async function sendEmail(templateId, templateParams) {
  try {
    // EmailJS API requires specific structure
    const emailData = {
      service_id: EMAILJS_SERVICE_ID,
      template_id: templateId,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: templateParams
    };

    console.log('📧 Sending email with data:', JSON.stringify(emailData, null, 2));

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData)
    });

    const responseText = await response.text();
    console.log('📧 EmailJS response status:', response.status);
    console.log('📧 EmailJS response text:', responseText);

    if (!response.ok) {
      console.error('❌ EmailJS error:', response.status, responseText);
      throw new Error(`EmailJS error: ${response.status} - ${responseText}`);
    } else {
      console.log('✅ Email sent successfully via EmailJS API');
      return { success: true, response: responseText };
    }
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw error;
  }
}

// HTML page generators (same as before)
function generateSuccessPage(title, message, details = []) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400;500;600;700&display=swap');
        
        body {
            font-family: 'Josefin Sans', sans-serif;
            background: linear-gradient(135deg, #007e8c 0%, #00a676 100%);
            margin: 0;
            padding: 40px 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .container {
            background: white;
            border-radius: 16px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }
        
        .success-icon {
            font-size: 4rem;
            margin-bottom: 20px;
        }
        
        h1 {
            color: #007e8c;
            font-size: 2rem;
            margin-bottom: 16px;
            font-weight: 700;
        }
        
        .message {
            color: #4a6166;
            font-size: 1.1rem;
            line-height: 1.6;
            margin-bottom: 30px;
        }
        
        .details {
            background: #f8feff;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 30px;
            text-align: left;
        }
        
        .details h3 {
            color: #007e8c;
            margin-bottom: 15px;
            font-size: 1.1rem;
        }
        
        .details p {
            color: #4a6166;
            margin: 8px 0;
            font-size: 0.95rem;
        }
        
        .footer {
            color: #7a9199;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✅</div>
        <h1>${title}</h1>
        <div class="message">${message}</div>
        
        ${details.length > 0 ? `
        <div class="details">
            <h3>Booking Details:</h3>
            ${details.map(detail => `<p>${detail}</p>`).join('')}
        </div>
        ` : ''}
        
        <div class="footer">
            You can safely close this window.<br>
            <strong>Rejuvenators Mobile Massage</strong>
        </div>
    </div>
</body>
</html>`;
}

function generateErrorPage(message) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error - Booking Response</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@300;400;500;600;700&display=swap');
        
        body {
            font-family: 'Josefin Sans', sans-serif;
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
            margin: 0;
            padding: 40px 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .container {
            background: white;
            border-radius: 16px;
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }
        
        .error-icon {
            font-size: 4rem;
            margin-bottom: 20px;
        }
        
        h1 {
            color: #dc3545;
            font-size: 2rem;
            margin-bottom: 16px;
            font-weight: 700;
        }
        
        .message {
            color: #4a6166;
            font-size: 1.1rem;
            line-height: 1.6;
            margin-bottom: 30px;
        }
        
        .contact-info {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 30px;
        }
        
        .contact-info h3 {
            color: #007e8c;
            margin-bottom: 10px;
        }
        
        .contact-info p {
            color: #4a6166;
            margin: 5px 0;
        }
        
        .footer {
            color: #7a9199;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">❌</div>
        <h1>Unable to Process Request</h1>
        <div class="message">${message}</div>
        
        <div class="contact-info">
            <h3>Need Help?</h3>
            <p><strong>Call:</strong> 1300 302542</p>
            <p><strong>Email:</strong> info@rejuvenators.com</p>
        </div>
        
        <div class="footer">
            <strong>Rejuvenators Mobile Massage</strong><br>
            We're here to help resolve any issues.
        </div>
    </div>
</body>
</html>`;
}
