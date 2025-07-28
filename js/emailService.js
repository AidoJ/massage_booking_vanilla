// EmailJS configuration - will be set from environment variables
let EMAILJS_SERVICE_ID = 'service_puww2kb';
let EMAILJS_TEMPLATE_ID = 'template_ai9rrg6'; // Customer request template
let EMAILJS_PUBLIC_KEY = 'qfM_qA664E4JddSMN';

// Initialize EmailJS when the script loads
(function() {
    // Wait for EmailJS to be available
    const initEmailJS = () => {
        if (typeof emailjs !== 'undefined') {
            emailjs.init(EMAILJS_PUBLIC_KEY);
            console.log('✅ EmailJS initialized successfully');
            return true;
        }
        return false;
    };
    
    // Try to initialize immediately
    if (!initEmailJS()) {
        // If not available, wait and try again
        setTimeout(initEmailJS, 1000);
    }
})();

// Email service functions
const EmailService = {
  // Send Email 1: Booking Request to Customer (excluding therapist fees)
  async sendBookingRequestToCustomer(bookingData) {
    console.log('📧 Sending booking request email to customer...', bookingData);
    
    // Ensure EmailJS is initialized
    if (typeof emailjs === 'undefined') {
      console.error('❌ EmailJS not loaded');
      return { success: false, error: 'EmailJS not loaded' };
    }
    
    try {
      // Send parameters that match the template variables exactly
      const templateParams = {
        to_email: bookingData.customer_email,
        to_name: bookingData.customer_name,
        customer_name: bookingData.customer_name,
        customer_email: bookingData.customer_email,
        customer_code: bookingData.customer_code || 'N/A',
        booking_id: bookingData.booking_id,
        service: bookingData.service_name,
        duration: bookingData.duration_minutes + ' minutes',
        date_time: bookingData.booking_date + ' at ' + bookingData.booking_time,
        address: bookingData.address,
        business_name: bookingData.business_name || '',
        room_number: bookingData.room_number || '',
        gender_preference: bookingData.gender_preference || 'No preference',
        therapist: bookingData.therapist_name || 'Available Therapist',
        parking: bookingData.parking || 'N/A',
        booker_name: bookingData.booker_name || '',
        notes: bookingData.notes || '',
        estimated_price: bookingData.total_price || 'N/A',
        base_price: bookingData.base_price || bookingData.total_price || 'N/A'
        // NOTE: Excluding therapist_fee from customer email
      };

      console.log('📧 Customer template parameters:', templateParams);

      const response = await emailjs.send(
        EMAILJS_SERVICE_ID, 
        EMAILJS_TEMPLATE_ID, 
        templateParams
      );

      console.log('✅ Customer email sent successfully:', response);
      return { success: true, message: 'Customer email sent successfully' };

    } catch (error) {
      console.error('❌ Error sending customer email:', error);
      return { success: false, error: error.message };
    }
  },

  // Send Email 2: Booking Request to Selected Therapist (including therapist fees)
  async sendBookingRequestToSelectedTherapist(bookingData, therapistData) {
    console.log('📧 Sending booking request to selected therapist...', { bookingData, therapistData });
    
    // Ensure EmailJS is initialized
    if (typeof emailjs === 'undefined') {
      console.error('❌ EmailJS not loaded');
      return { success: false, error: 'EmailJS not loaded' };
    }
    
    try {
      // Generate accept/decline URLs with booking and therapist IDs
      const acceptUrl = `${window.location.origin}/api/booking/accept?booking_id=${bookingData.booking_id}&therapist_id=${therapistData.id}`;
      const declineUrl = `${window.location.origin}/api/booking/decline?booking_id=${bookingData.booking_id}&therapist_id=${therapistData.id}`;
      
      // Send parameters that match the therapist template variables
      const templateParams = {
        to_email: therapistData.email,
        to_name: therapistData.name,
        therapist_name: therapistData.name,
        booking_id: bookingData.booking_id,
        customer_code: bookingData.customer_code || 'N/A',
        customer_name: bookingData.customer_name,
        customer_email: bookingData.customer_email,
        business_name: bookingData.business_name || '',
        address: bookingData.address,
        service: bookingData.service_name,
        duration: bookingData.duration_minutes + ' minutes',
        date_time: bookingData.booking_date + ' at ' + bookingData.booking_time,
        gender_preference: bookingData.gender_preference || 'No preference',
        parking: bookingData.parking || 'N/A',
        room_number: bookingData.room_number || '',
        booker_name: bookingData.booker_name || '',
        notes: bookingData.notes || '',
        therapist_fee: bookingData.therapist_fee || 'N/A',
        response_timeout_minutes: bookingData.response_timeout_minutes || '30',
        accept_url: acceptUrl,
        decline_url: declineUrl
      };

      console.log('📧 Therapist template parameters:', templateParams);

      // Use therapist template ID
      const therapistTemplateId = 'template_therapist_request'; // You'll need to create this template
      
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID, 
        therapistTemplateId, 
        templateParams
      );

      console.log('✅ Therapist email sent successfully:', response);
      return { success: true, message: 'Therapist email sent successfully' };

    } catch (error) {
      console.error('❌ Error sending therapist email:', error);
      return { success: false, error: error.message };
    }
  },

  // Send Email 3: Booking Confirmation to Customer (when therapist accepts)
  async sendBookingConfirmationToCustomer(bookingData) {
    console.log('📧 Sending booking confirmation to customer...', bookingData);
    
    try {
      const templateParams = {
        to_email: bookingData.customer_email,
        to_name: bookingData.customer_name,
        customer_name: bookingData.customer_name,
        booking_id: bookingData.booking_id,
        service: bookingData.service_name,
        duration: bookingData.duration_minutes + ' minutes',
        date_time: bookingData.booking_date + ' at ' + bookingData.booking_time,
        address: bookingData.address,
        therapist: bookingData.therapist_name,
        estimated_price: bookingData.total_price || 'N/A'
      };

      const confirmationTemplateId = 'template_booking_confirmed'; // You'll need to create this
      
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID, 
        confirmationTemplateId, 
        templateParams
      );

      console.log('✅ Booking confirmation sent to customer:', response);
      return { success: true, message: 'Booking confirmation sent' };

    } catch (error) {
      console.error('❌ Error sending booking confirmation:', error);
      return { success: false, error: error.message };
    }
  },

  // Send Email 4: Booking Confirmation to Therapist (when therapist accepts)
  async sendBookingConfirmationToTherapist(bookingData, therapistData) {
    console.log('📧 Sending booking confirmation to therapist...', { bookingData, therapistData });
    
    try {
      const templateParams = {
        to_email: therapistData.email,
        to_name: therapistData.name,
        therapist_name: therapistData.name,
        booking_id: bookingData.booking_id,
        customer_name: bookingData.customer_name,
        customer_email: bookingData.customer_email,
        service: bookingData.service_name,
        duration: bookingData.duration_minutes + ' minutes',
        date_time: bookingData.booking_date + ' at ' + bookingData.booking_time,
        address: bookingData.address,
        therapist_fee: bookingData.therapist_fee || 'N/A'
      };

      const therapistConfirmationTemplateId = 'template_therapist_confirmed'; // You'll need to create this
      
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID, 
        therapistConfirmationTemplateId, 
        templateParams
      );

      console.log('✅ Booking confirmation sent to therapist:', response);
      return { success: true, message: 'Therapist confirmation sent' };

    } catch (error) {
      console.error('❌ Error sending therapist confirmation:', error);
      return { success: false, error: error.message };
    }
  },

  // Send Email 5: "Looking for Alternate" to Customer (when therapist declines)
  async sendLookingForAlternateToCustomer(bookingData) {
    console.log('📧 Sending "looking for alternate" email to customer...', bookingData);
    
    try {
      const templateParams = {
        to_email: bookingData.customer_email,
        to_name: bookingData.customer_name,
        customer_name: bookingData.customer_name,
        booking_id: bookingData.booking_id,
        service: bookingData.service_name,
        duration: bookingData.duration_minutes + ' minutes',
        date_time: bookingData.booking_date + ' at ' + bookingData.booking_time
      };

      const alternateTemplateId = 'template_looking_alternate'; // You'll need to create this
      
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID, 
        alternateTemplateId, 
        templateParams
      );

      console.log('✅ "Looking for alternate" email sent to customer:', response);
      return { success: true, message: 'Alternate search email sent' };

    } catch (error) {
      console.error('❌ Error sending alternate search email:', error);
      return { success: false, error: error.message };
    }
  },

  // Send Email 6: Booking Declined to Customer (when no therapist accepts)
  async sendBookingDeclinedToCustomer(bookingData) {
    console.log('📧 Sending booking declined email to customer...', bookingData);
    
    try {
      const templateParams = {
        to_email: bookingData.customer_email,
        to_name: bookingData.customer_name,
        customer_name: bookingData.customer_name,
        booking_id: bookingData.booking_id,
        service: bookingData.service_name,
        duration: bookingData.duration_minutes + ' minutes',
        date_time: bookingData.booking_date + ' at ' + bookingData.booking_time
      };

      const declinedTemplateId = 'template_booking_declined'; // You'll need to create this
      
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID, 
        declinedTemplateId, 
        templateParams
      );

      console.log('✅ Booking declined email sent to customer:', response);
      return { success: true, message: 'Booking declined email sent' };

    } catch (error) {
      console.error('❌ Error sending booking declined email:', error);
      return { success: false, error: error.message };
    }
  }
};

// Export for use in other modules
window.EmailService = EmailService; 