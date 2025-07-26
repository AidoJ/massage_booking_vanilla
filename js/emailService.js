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
      // Pass through all data exactly as received from booking form
      const templateParams = {
        to_email: bookingData.customer_email,
        customer_name: bookingData.customer_name,
        customer_email: bookingData.customer_email,
        booking_id: bookingData.booking_id,
        service_name: bookingData.service_name,
        duration_minutes: bookingData.duration_minutes,
        booking_date: bookingData.booking_date,
        booking_time: bookingData.booking_time,
        address: bookingData.address,
        business_name: bookingData.business_name,
        room_number: bookingData.room_number,
        gender_preference: bookingData.gender_preference,
        therapist_name: bookingData.therapist_name,
        parking: bookingData.parking,
        booker_name: bookingData.booker_name,
        notes: bookingData.notes,
        total_price: bookingData.total_price
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