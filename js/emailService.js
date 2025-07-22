// EmailJS configuration - will be set from environment variables
let EMAILJS_SERVICE_ID = 'service_puww2kb';
let EMAILJS_TEMPLATE_ID = 'template_zh8jess';
let EMAILJS_PUBLIC_KEY = 'V8qq2pjH8vfh3a6q3';

// Template IDs for different email types
const EMAIL_TEMPLATE_IDS = {
  bookingRequestReceived: 'template_1qnwhwc', // Email 1: Booking Request Received
  therapistRequest: 'template_zh8jess', // Replace with Email 2 template ID
  clientAcceptance: 'template_zh8jess', // Replace with Email 3 template ID
  therapistAcceptance: 'template_zh8jess', // Replace with Email 4 template ID
  clientDecline: 'template_zh8jess', // Replace with Email 5 template ID
  alternateTherapistRequest: 'template_zh8jess', // Replace with Email 6 template ID
  clientAcceptanceAlt: 'template_zh8jess', // Replace with Email 7 template ID
  therapistAcceptanceAlt: 'template_zh8jess', // Replace with Email 8 template ID
  clientFinalDecline: 'template_zh8jess' // Replace with Email 9 template ID
};

// Initialize EmailJS when the script loads
(function() {
  // Wait for EmailJS to be available
  const initEmailJS = () => {
    if (typeof emailjs !== 'undefined') {
      emailjs.init(EMAILJS_PUBLIC_KEY);
      console.log('✅ EmailJS initialized successfully');
      return true;
    } else {
      console.log('⏳ EmailJS not ready yet, retrying...');
      return false;
    }
  };

  // Try to initialize immediately
  if (!initEmailJS()) {
    // If not ready, retry after a short delay
    setTimeout(() => {
      if (!initEmailJS()) {
        console.error('❌ EmailJS failed to load after retry');
      }
    }, 1000);
  }
})();

// Email service functions
const EmailService = {
  // Send Email 1: Booking Request Received to Client
  async sendBookingRequestReceived(bookingData) {
    console.log('📧 Sending Email 1 - Booking Request Received', bookingData);
    
    try {
      // Prepare template parameters for EmailJS
      const templateParams = {
        to_email: bookingData.customer_email,
        to_name: bookingData.customer_name,
        customer_name: bookingData.customer_name,
        customer_email: bookingData.customer_email,
        customer_phone: bookingData.customer_phone,
        booking_id: bookingData.booking_id,
        business_name: bookingData.business_name || 'Rydges South Bank Brisbane',
        address: bookingData.address,
        service_name: bookingData.service_name,
        therapist_name: bookingData.therapist_name || 'Jane test',
        gender_preference: bookingData.gender_preference || 'Don\'t mind just want a great massage',
        alternate_therapist_ok: bookingData.alternate_therapist_ok ? 'Yes' : 'No',
        duration_minutes: bookingData.duration_minutes,
        booking_date: bookingData.booking_date,
        booking_time: bookingData.booking_time,
        room_number: bookingData.room_number || '123',
        booker_name: bookingData.booker_name || 'Aidan Test',
        notes: bookingData.notes || 'Access via lift 2, ive got a bad back ache',
        total_price: bookingData.total_price || '$159.00',
        email_type: 'booking_request_received'
      };

      // Send email using EmailJS
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID, 
        EMAIL_TEMPLATE_IDS.bookingRequestReceived, 
        templateParams
      );

      console.log('✅ Email 1 sent successfully:', response);

      // Save email record to database
      const { data, error } = await supabase
        .from('email_logs')
        .insert([
          {
            booking_id: bookingData.booking_id,
            email_type: 'booking_request_received',
            recipient_email: bookingData.customer_email,
            subject: '📧 Booking Request Received',
            html_content: 'Email sent via EmailJS template',
            sent_at: new Date().toISOString(),
            status: 'sent'
          }
        ]);

      if (error) {
        console.error('Error saving email log:', error);
        // Don't throw error here as email was sent successfully
      }

      return {
        success: true,
        emailId: data?.[0]?.id,
        message: 'Email 1 sent successfully'
      };

    } catch (error) {
      console.error('❌ Error sending Email 1:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Send booking request confirmation to client (legacy function - now uses new template)
  async sendClientConfirmation(bookingData) {
    console.log('📧 Attempting to send client confirmation email...', bookingData);
    
    // Transform booking data to match new template format
    const transformedData = {
      customer_name: bookingData.customer_name,
      customer_email: bookingData.customer_email,
      customer_phone: bookingData.customer_phone,
      booking_id: bookingData.booking_id,
      service_name: bookingData.service_name,
      duration_minutes: bookingData.duration_minutes,
      booking_date: bookingData.booking_time ? new Date(bookingData.booking_time).toISOString().split('T')[0] : '2025-07-01',
      booking_time: bookingData.booking_time ? new Date(bookingData.booking_time).toTimeString().slice(0, 5) : '09:00',
      address: bookingData.address,
      room_number: bookingData.room_number || '123',
      business_name: 'Rydges South Bank Brisbane',
      therapist_name: bookingData.therapist_name || 'Jane test',
      gender_preference: 'Don\'t mind just want a great massage',
      alternate_therapist_ok: true,
      booker_name: 'Aidan Test',
      notes: 'Access via lift 2, ive got a bad back ache',
      total_price: bookingData.price || '$159.00'
    };

    return await this.sendBookingRequestReceived(transformedData);
  },

  // Send booking request to therapists
  async sendTherapistNotification(bookingData, therapists) {
    const results = [];
    
    for (const therapist of therapists) {
      const templateParams = {
        to_email: therapist.email,
        to_name: `${therapist.first_name} ${therapist.last_name}`,
        booking_id: bookingData.booking_id,
        client_name: bookingData.customer_name,
        client_email: bookingData.customer_email,
        client_phone: bookingData.customer_phone,
        address: bookingData.address,
        service_name: bookingData.service_name,
        duration: bookingData.duration_minutes,
        date: bookingData.booking_time,
        room_number: bookingData.room_number || 'N/A',
        booker_name: bookingData.booker_name,
        therapist_fee: bookingData.therapist_fee,
        hourly_rate: bookingData.hourly_rate,
        response_timeout: bookingData.response_timeout || 2,
        accept_url: `${window.location.origin}/.netlify/functions/booking-response?booking_id=${bookingData.booking_id}&therapist_id=${therapist.id}&action=accept`,
        decline_url: `${window.location.origin}/.netlify/functions/booking-response?booking_id=${bookingData.booking_id}&therapist_id=${therapist.id}&action=decline`,
        email_type: 'therapist_notification'
      };

      try {
        const response = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
        console.log(`Therapist notification sent to ${therapist.email}:`, response);
        results.push({ therapist_id: therapist.id, success: true });
      } catch (error) {
        console.error(`Error sending therapist notification to ${therapist.email}:`, error);
        results.push({ therapist_id: therapist.id, success: false, error });
      }
    }

    return results;
  },

  // Send booking confirmation to client when accepted
  async sendClientAcceptance(bookingData, therapistData) {
    const templateParams = {
      to_email: bookingData.customer_email,
      to_name: bookingData.customer_name,
      booking_id: bookingData.booking_id,
      therapist_name: `${therapistData.first_name} ${therapistData.last_name}`,
      service_name: bookingData.service_name,
      duration: bookingData.duration_minutes,
      date: bookingData.booking_time,
      address: bookingData.address,
      room_number: bookingData.room_number || 'N/A',
      price: bookingData.price,
      email_type: 'client_acceptance'
    };

    try {
      const response = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
      console.log('Client acceptance email sent:', response);
      return { success: true };
    } catch (error) {
      console.error('Error sending client acceptance email:', error);
      return { success: false, error };
    }
  },

  // Send booking confirmation to therapist when accepted
  async sendTherapistAcceptance(bookingData, therapistData) {
    const templateParams = {
      to_email: therapistData.email,
      to_name: `${therapistData.first_name} ${therapistData.last_name}`,
      booking_id: bookingData.booking_id,
      client_name: bookingData.customer_name,
      service_name: bookingData.service_name,
      duration: bookingData.duration_minutes,
      date: bookingData.booking_time,
      address: bookingData.address,
      room_number: bookingData.room_number || 'N/A',
      therapist_fee: bookingData.therapist_fee,
      email_type: 'therapist_acceptance'
    };

    try {
      const response = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
      console.log('Therapist acceptance email sent:', response);
      return { success: true };
    } catch (error) {
      console.error('Error sending therapist acceptance email:', error);
      return { success: false, error };
    }
  },

  // Send decline notification to client
  async sendClientDecline(bookingData) {
    const templateParams = {
      to_email: bookingData.customer_email,
      to_name: bookingData.customer_name,
      booking_id: bookingData.booking_id,
      service_name: bookingData.service_name,
      date: bookingData.booking_time,
      fallback_option: bookingData.fallback_option,
      email_type: 'client_decline'
    };

    try {
      const response = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
      console.log('Client decline email sent:', response);
      return { success: true };
    } catch (error) {
      console.error('Error sending client decline email:', error);
      return { success: false, error };
    }
  },

  // Send final decline notification to client (no more therapists available)
  async sendClientFinalDecline(bookingData) {
    const templateParams = {
      to_email: bookingData.customer_email,
      to_name: bookingData.customer_name,
      booking_id: bookingData.booking_id,
      service_name: bookingData.service_name,
      date: bookingData.booking_time,
      email_type: 'client_final_decline'
    };

    try {
      const response = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
      console.log('Client final decline email sent:', response);
      return { success: true };
    } catch (error) {
      console.error('Error sending client final decline email:', error);
      return { success: false, error };
    }
  }
};

// Export for use in other modules
window.EmailService = EmailService; 