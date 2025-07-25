// EmailJS configuration - will be set from environment variables
let EMAILJS_SERVICE_ID = 'service_puww2kb';
let EMAILJS_TEMPLATE_ID = 'template_zqjm4om'; // Use the new comprehensive template
let EMAILJS_PUBLIC_KEY = 'V8qq2pjH8vfh3a6q3';

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
      // Use basic EmailJS parameters that most templates expect
      const templateParams = {
        to_email: bookingData.customer_email,
        to_name: `${bookingData.first_name || ''} ${bookingData.last_name || ''}`.trim() || 'Valued Customer',
        from_name: 'Rejuvenators Mobile Massage',
        from_email: 'noreply@rejuvenators.com',
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

Thank you for choosing Rejuvenators Mobile Massage!`,
        
        // Additional parameters for the template
        customer_name: `${bookingData.first_name || ''} ${bookingData.last_name || ''}`.trim(),
        customer_email: bookingData.customer_email,
        customer_phone: bookingData.customer_phone || 'N/A',
        booking_id: bookingData.booking_id,
        business_name: bookingData.business_name || 'Rydges South Bank Brisbane',
        address: bookingData.address || 'N/A',
        service_name: bookingData.service_name,
        therapist_name: bookingData.therapist_name || 'Jane test',
        gender_preference: bookingData.gender_preference || 'Don\'t mind just want a great massage',
        alternate_therapist_ok: bookingData.alternate_therapist_ok ? 'Yes' : 'No',
        duration_minutes: bookingData.duration_minutes,
        booking_date: bookingData.booking_date || '2025-07-25',
        booking_time: bookingData.booking_time || '09:00',
        room_number: bookingData.room_number || '123',
        booker_name: bookingData.booker_name || 'Aidan Test',
        notes: bookingData.notes || 'Access via lift 2, ive got a bad back ache',
        total_price: bookingData.total_price || 'N/A',
        email_type: 'booking_request_received'
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