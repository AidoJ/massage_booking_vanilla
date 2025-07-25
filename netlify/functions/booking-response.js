const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://dcukfurezlkagvvwgsgr.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjdWtmdXJlemxrYWd2dndnc2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MjM0NjQsImV4cCI6MjA2NzQ5OTQ2NH0.ThXQKNHj0XpSkPa--ghmuRXFJ7nfcf0YVlH0liHofFw';
const supabase = createClient(supabaseUrl, supabaseKey);

// EmailJS configuration
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_puww2kb';
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID || 'template_zqjm4om';
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'qfM_qA664E4JddSMN';

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
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
    // Parse query parameters
    const { booking_id, therapist_id, action } = event.queryStringParameters || {};
    
    if (!booking_id || !therapist_id || !action) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }

    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        therapist_profiles!inner(*),
        services(*),
        customers(*)
      `)
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Booking not found' })
      };
    }

    // Check if booking is still pending
    if (booking.status !== 'requested') {
      return {
        statusCode: 302,
        headers: {
          ...headers,
          'Location': `/booking-response.html?status=already&action=${action}`
        },
        body: ''
      };
    }

    // Check if response is within timeout window
    const settings = await supabase.from('settings').select('*').single();
    const timeoutMinutes = settings?.data?.therapist_response_timeout_minutes || 2;
    const bookingTime = new Date(booking.created_at);
    const now = new Date();
    const timeDiff = (now - bookingTime) / (1000 * 60); // minutes

    if (timeDiff > timeoutMinutes) {
      return {
        statusCode: 302,
        headers: {
          ...headers,
          'Location': `/booking-response.html?status=timeout&action=${action}`
        },
        body: ''
      };
    }

    // Update booking status
    const newStatus = action === 'accept' ? 'confirmed' : 'declined';
    const updateData = {
      status: newStatus,
      therapist_response_time: new Date().toISOString(),
      responding_therapist_id: therapist_id
    };

    const { error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', booking_id);

    if (updateError) {
      console.error('Error updating booking:', updateError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to update booking' })
      };
    }

    // Send appropriate emails based on action
    if (action === 'accept') {
      // Send confirmation email to client
      await sendEmail('client_confirmation', {
        to_email: booking.customer_email,
        to_name: booking.customer_name,
        booking_id: booking_id,
        therapist_name: `${booking.therapist_profiles.first_name} ${booking.therapist_profiles.last_name}`,
        service_name: booking.services.name,
        duration: booking.duration_minutes,
        date: booking.booking_time,
        address: booking.address,
        room_number: booking.room_number,
        price: booking.price
      });

      // Send confirmation email to therapist
      await sendEmail('therapist_confirmation', {
        to_email: booking.therapist_profiles.email,
        to_name: `${booking.therapist_profiles.first_name} ${booking.therapist_profiles.last_name}`,
        booking_id: booking_id,
        client_name: booking.customer_name,
        service_name: booking.services.name,
        duration: booking.duration_minutes,
        date: booking.booking_time,
        address: booking.address,
        room_number: booking.room_number,
        therapist_fee: booking.therapist_fee
      });
    } else {
      // Send decline notification to client
      await sendEmail('client_decline', {
        to_email: booking.customer_email,
        to_name: booking.customer_name,
        booking_id: booking_id,
        service_name: booking.services.name,
        date: booking.booking_time,
        fallback_option: booking.fallback_option
      });

      // If fallback option is enabled, notify other available therapists
      if (booking.fallback_option === 'yes') {
        await notifyAlternateTherapists(booking);
      }
    }

    // Redirect to confirmation page
    return {
      statusCode: 302,
      headers: {
        ...headers,
        'Location': `/booking-response.html?status=success&action=${action}`
      },
      body: ''
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

// Helper function to send emails via EmailJS
async function sendEmail(templateType, templateParams) {
  try {
    const response = await fetch(`https://api.emailjs.com/api/v1.0/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: templateParams
      })
    });

    if (!response.ok) {
      console.error('EmailJS error:', await response.text());
    }
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

// Helper function to notify alternate therapists
async function notifyAlternateTherapists(booking) {
  try {
    // Get all available therapists for this service and time slot
    const { data: therapists, error } = await supabase
      .from('therapist_profiles')
      .select(`
        *,
        therapist_services!inner(service_id)
      `)
      .eq('therapist_services.service_id', booking.service_id)
      .eq('is_active', true)
      .neq('id', booking.therapist_id);

    if (error || !therapists) {
      console.error('Error fetching alternate therapists:', error);
      return;
    }

    // Send notification to each alternate therapist
    for (const therapist of therapists) {
      await sendEmail('alternate_therapist_notification', {
        to_email: therapist.email,
        to_name: `${therapist.first_name} ${therapist.last_name}`,
        booking_id: booking.id,
        client_name: booking.customer_name,
        service_name: booking.services.name,
        duration: booking.duration_minutes,
        date: booking.booking_time,
        address: booking.address,
        room_number: booking.room_number,
        accept_url: `${process.env.URL}/.netlify/functions/booking-response?booking_id=${booking.id}&therapist_id=${therapist.id}&action=accept`,
        decline_url: `${process.env.URL}/.netlify/functions/booking-response?booking_id=${booking.id}&therapist_id=${therapist.id}&action=decline`
      });
    }
  } catch (error) {
    console.error('Error notifying alternate therapists:', error);
  }
} 