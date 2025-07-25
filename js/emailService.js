// EmailJS configuration - will be set from environment variables
let EMAILJS_SERVICE_ID = 'service_puww2kb';
let EMAILJS_TEMPLATE_ID = 'template_zqjm4om'; // Use the new comprehensive template
let EMAILJS_PUBLIC_KEY = 'qfM_qA664E4JddSMN';

// Initialize EmailJS when the script loads
(function() {
    if (typeof emailjs !== 'undefined') {
      emailjs.init(EMAILJS_PUBLIC_KEY);
      console.log('✅ EmailJS initialized successfully');
  }
})();

// Email service functions
const EmailService = {
  // Send Email 1: Booking Request Received to Client
  async sendBookingRequestReceived(bookingData) {
    console.log('📧 Sending booking confirmation email...', bookingData);
    
    try {
      // Simplified template parameters - only essential fields
      const templateParams = {
        customer_name: `${bookingData.first_name || ''} ${bookingData.last_name || ''}`.trim() || 'Valued Customer',
        customer_email: bookingData.customer_email,
        customer_phone: bookingData.customer_phone || 'N/A',
        booking_id: bookingData.booking_id,
        business_name: bookingData.business_name || '',
        address: bookingData.address || 'N/A',
        service_name: bookingData.service_name,
        therapist_name: bookingData.therapist_name || 'Available Therapist',
        gender_preference: bookingData.gender_preference || 'No preference',
        duration_minutes: bookingData.duration_minutes,
        booking_date: bookingData.booking_date,
        booking_time: bookingData.booking_time,
        room_number: bookingData.room_number || '',
        booker_name: bookingData.booker_name || '',
        notes: bookingData.notes || '',
        total_price: bookingData.total_price || 'N/A',
        parking: bookingData.parking || 'N/A'
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