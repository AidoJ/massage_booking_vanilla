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
      // Use EmailJS standard parameters that work with any template
      const templateParams = {
        to_email: bookingData.customer_email,
        to_name: `${bookingData.first_name || ''} ${bookingData.last_name || ''}`.trim() || 'Valued Customer',
        from_name: 'Rejuvenators Mobile Massage',
        reply_to: 'info@rejuvenators.com',
        message: `Your booking request has been received!

Booking Details:
- Booking ID: ${bookingData.booking_id}
- Service: ${bookingData.service_name}
- Date: ${bookingData.booking_date}
- Time: ${bookingData.booking_time}
- Address: ${bookingData.address}
- Duration: ${bookingData.duration_minutes} minutes
- Price: ${bookingData.total_price}

We will contact you shortly to confirm your booking.

Thank you for choosing Rejuvenators Mobile Massage!`
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