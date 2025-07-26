// EmailJS configuration - will be set from environment variables
let EMAILJS_SERVICE_ID = 'service_puww2kb';
let EMAILJS_TEMPLATE_ID = 'template_ewtvv1j'; // Use the new professional template
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
  // Send Email 1: Booking Request Received to Client
  async sendBookingRequestReceived(bookingData) {
    console.log('📧 Sending booking confirmation email...', bookingData);
    
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
        base_price: bookingData.base_price || bookingData.total_price || 'N/A',
        therapist_fee: bookingData.therapist_fee || 'N/A'
      };

      console.log('📧 Template parameters:', templateParams);

      const response = await emailjs.send(
        EMAILJS_SERVICE_ID, 
        EMAILJS_TEMPLATE_ID, 
        templateParams
      );

      console.log('✅ Email sent successfully:', response);
      return { success: true, message: 'Email sent successfully' };

    } catch (error) {
      console.error('❌ Error sending email:', error);
      return { success: false, error: error.message };
    }
  }
};

// Export for use in other modules
window.EmailService = EmailService; 