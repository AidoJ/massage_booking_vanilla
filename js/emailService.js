// EmailJS configuration - will be set from environment variables
let EMAILJS_SERVICE_ID = 'service_puww2kb';
let EMAILJS_TEMPLATE_ID = 'template_zh8jess';
let EMAILJS_PUBLIC_KEY = 'V8qq2pjH8vfh3a6q3';

// Initialize EmailJS when the script loads
(function() {
  // Wait for EmailJS to be available
  if (typeof emailjs !== 'undefined') {
    emailjs.init(EMAILJS_PUBLIC_KEY);
    console.log('✅ EmailJS initialized successfully');
  } else {
    console.error('❌ EmailJS not loaded');
  }
})();

// Email service functions
const EmailService = {
  // Send booking request confirmation to client
  async sendClientConfirmation(bookingData) {
    console.log('📧 Attempting to send client confirmation email...', bookingData);
    
    const templateParams = {
      to_email: bookingData.customer_email,
      to_name: bookingData.customer_name,
      booking_id: bookingData.booking_id,
      service_name: bookingData.service_name,
      duration: bookingData.duration_minutes,
      date: bookingData.booking_time,
      address: bookingData.address,
      room_number: bookingData.room_number || 'N/A',
      price: bookingData.price,
      email_type: 'client_confirmation'
    };

    console.log('📧 EmailJS config:', {
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      public_key: EMAILJS_PUBLIC_KEY
    });

    try {
      if (typeof emailjs === 'undefined') {
        throw new Error('EmailJS not loaded');
      }
      
      const response = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
      console.log('✅ Client confirmation email sent successfully:', response);
      return { success: true };
    } catch (error) {
      console.error('❌ Error sending client confirmation email:', error);
      return { success: false, error };
    }
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