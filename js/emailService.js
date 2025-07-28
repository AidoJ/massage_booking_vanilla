// EmailJS configuration - will be set from environment variables
let EMAILJS_SERVICE_ID = 'service_puww2kb';
let EMAILJS_TEMPLATE_ID = 'template_ai9rrg6'; // Client booking confirmation template
let EMAILJS_THERAPIST_REQUEST_TEMPLATE_ID = 'template_51wt6of'; // New therapist booking request template
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
  // Send Email 1: Booking Request Received to Client (EXISTING)
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
  },

  // Send Email 2: Booking Request to Therapist (NEW)
  async sendTherapistBookingRequest(bookingData, therapistData, timeoutMinutes) {
    console.log('📧 Sending therapist booking request...', { bookingData, therapistData, timeoutMinutes });
    
    // Ensure EmailJS is initialized
    if (typeof emailjs === 'undefined') {
      console.error('❌ EmailJS not loaded');
      return { success: false, error: 'EmailJS not loaded' };
    }
    
    try {
      // Generate Accept/Decline URLs
      const baseUrl = window.location.origin;
      const acceptUrl = `${baseUrl}/api/booking-response?action=accept&booking=${bookingData.booking_id}&therapist=${therapistData.id}`;
      const declineUrl = `${baseUrl}/api/booking-response?action=decline&booking=${bookingData.booking_id}&therapist=${therapistData.id}`;
      
      // Calculate therapist fee
      const therapistFee = bookingData.therapist_fee ? `$${parseFloat(bookingData.therapist_fee).toFixed(2)}` : 'TBD';
      
      // Format client phone for display
      const clientPhone = bookingData.customer_phone || 'Not provided';
      
      // Determine booking type display
      let bookingTypeDisplay = bookingData.booking_type || 'Standard Booking';
      if (bookingTypeDisplay === 'Hotel/Accommodation') {
        bookingTypeDisplay = '🏨 Hotel/Accommodation';
      } else if (bookingTypeDisplay === 'In-home') {
        bookingTypeDisplay = '🏠 In-Home Service';
      } else if (bookingTypeDisplay === 'Corporate Event/Office') {
        bookingTypeDisplay = '🏢 Corporate/Office';
      }
      
      // Send parameters that match the therapist template variables
      const templateParams = {
        to_email: therapistData.email,
        to_name: `${therapistData.first_name} ${therapistData.last_name}`,
        therapist_name: `${therapistData.first_name} ${therapistData.last_name}`,
        booking_id: bookingData.booking_id,
        client_name: `${bookingData.first_name || ''} ${bookingData.last_name || ''}`.trim(),
        client_phone: clientPhone,
        service_name: bookingData.service_name || 'Massage Service',
        duration: `${bookingData.duration_minutes || 60} minutes`,
        booking_date: bookingData.booking_date || new Date().toLocaleDateString(),
        booking_time: bookingData.booking_time || '09:00',
        address: bookingData.address || 'Address not provided',
        business_name: bookingData.business_name || 'Private Residence',
        booking_type: bookingTypeDisplay,
        room_number: bookingData.room_number || 'N/A',
        booker_name: bookingData.booker_name || 'N/A',
        parking: bookingData.parking || 'Unknown',
        notes: bookingData.notes || 'No special notes',
        therapist_fee: therapistFee,
        timeout_minutes: timeoutMinutes || 60,
        accept_url: acceptUrl,
        decline_url: declineUrl
      };
      
      console.log('📧 Therapist email template parameters:', templateParams);
      
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID, 
        EMAILJS_THERAPIST_REQUEST_TEMPLATE_ID, 
        templateParams
      );
      
      console.log('✅ Therapist email sent successfully:', response);
      return { success: true, message: 'Therapist email sent successfully', response };
    } catch (error) {
      console.error('❌ Error sending therapist email:', error);
      return { success: false, error: error.message };
    }
  },

  // Send Email 3: Booking Confirmation to Client (when therapist accepts)
  async sendBookingConfirmation(bookingData, therapistData) {
    console.log('📧 Sending booking confirmation...', { bookingData, therapistData });
    
    // For now, we'll use the existing template structure
    // You can create a separate confirmation template later
    try {
      const templateParams = {
        to_email: bookingData.customer_email,
        to_name: `${bookingData.first_name} ${bookingData.last_name}`,
        customer_name: `${bookingData.first_name} ${bookingData.last_name}`,
        booking_id: bookingData.booking_id,
        service: bookingData.service_name,
        duration: bookingData.duration_minutes + ' minutes',
        date_time: bookingData.booking_date + ' at ' + bookingData.booking_time,
        address: bookingData.address,
        therapist: `${therapistData.first_name} ${therapistData.last_name}`,
        estimated_price: bookingData.price ? `$${bookingData.price.toFixed(2)}` : 'N/A'
      };
      
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID, 
        EMAILJS_TEMPLATE_ID, // Using existing template for now
        templateParams
      );
      
      console.log('✅ Confirmation email sent successfully:', response);
      return { success: true, message: 'Confirmation email sent successfully' };
    } catch (error) {
      console.error('❌ Error sending confirmation email:', error);
      return { success: false, error: error.message };
    }
  },

  // Send Email 4: Booking Declined to Client
  async sendBookingDeclined(bookingData, reason) {
    console.log('📧 Sending booking declined email...', { bookingData, reason });
    
    // For now, we'll use a simple notification
    // You can create a specific declined template later
    try {
      const templateParams = {
        to_email: bookingData.customer_email,
        to_name: `${bookingData.first_name} ${bookingData.last_name}`,
        customer_name: `${bookingData.first_name} ${bookingData.last_name}`,
        booking_id: bookingData.booking_id,
        service: bookingData.service_name,
        date_time: bookingData.booking_date + ' at ' + bookingData.booking_time,
        reason: reason || 'No therapists available at this time'
      };
      
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID, 
        EMAILJS_TEMPLATE_ID, // Using existing template for now - you may want a specific declined template
        templateParams
      );
      
      console.log('✅ Declined email sent successfully:', response);
      return { success: true, message: 'Declined email sent successfully' };
    } catch (error) {
      console.error('❌ Error sending declined email:', error);
      return { success: false, error: error.message };
    }
  }
};

// Export for use in other modules
window.EmailService = EmailService;
