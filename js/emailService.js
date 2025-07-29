// EmailJS configuration - UPDATED TEMPLATE IDs to match your documentation
let EMAILJS_SERVICE_ID = 'service_puww2kb';
let EMAILJS_TEMPLATE_ID = 'template_ai9rrg6'; // Client booking confirmation template
let EMAILJS_THERAPIST_REQUEST_TEMPLATE_ID = 'template_51wt6of'; // Therapist booking request template

// FIXED: Updated to match your documentation template IDs
let EMAILJS_BOOKING_CONFIRMED_TEMPLATE_ID = 'template_booking_confirmed'; // Client confirmation when accepted
let EMAILJS_THERAPIST_CONFIRMED_TEMPLATE_ID = 'template_therapist_confirmed'; // Therapist confirmation when accepted
let EMAILJS_BOOKING_DECLINED_TEMPLATE_ID = 'template_booking_declined'; // Client notification when declined
let EMAILJS_LOOKING_ALTERNATE_TEMPLATE_ID = 'template_looking_alternate'; // Client notification when looking for alternate

let EMAILJS_PUBLIC_KEY = 'qfM_qA664E4JddSMN';

// Initialize EmailJS when the script loads
(function() {
    const initEmailJS = () => {
        if (typeof emailjs !== 'undefined') {
            emailjs.init(EMAILJS_PUBLIC_KEY);
            console.log('✅ EmailJS initialized successfully');
            return true;
        }
        return false;
    };
    
    if (!initEmailJS()) {
        setTimeout(initEmailJS, 1000);
    }
})();

// Centralized email sending function
async function sendEmailViaAPI(templateId, templateParams) {
    try {
        console.log(`📧 Sending email via EmailJS API - Template: ${templateId}`);
        console.log('📧 Template parameters:', JSON.stringify(templateParams, null, 2));

        const emailData = {
            service_id: EMAILJS_SERVICE_ID,
            template_id: templateId,
            user_id: EMAILJS_PUBLIC_KEY,
            template_params: templateParams
        };

        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailData)
        });

        const responseText = await response.text();
        console.log('📧 EmailJS API response:', response.status, responseText);

        if (!response.ok) {
            throw new Error(`EmailJS API error: ${response.status} - ${responseText}`);
        }

        console.log('✅ Email sent successfully via EmailJS API');
        return { success: true, response: responseText };
    } catch (error) {
        console.error('❌ Error sending email via API:', error);
        throw error;
    }
}

// Email service functions
const EmailService = {
  // Email 1: Booking Request Received to Client (WORKING)
  async sendBookingRequestReceived(bookingData) {
    console.log('📧 Sending booking confirmation email...', bookingData);
    
    if (typeof emailjs === 'undefined') {
      console.error('❌ EmailJS not loaded');
      return { success: false, error: 'EmailJS not loaded' };
    }
    
    try {
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
        estimated_price: bookingData.total_price || 'N/A'
      };
      
      const response = await emailjs.send(
        EMAILJS_SERVICE_ID, 
        EMAILJS_TEMPLATE_ID, 
        templateParams
      );
      
      console.log('✅ Email sent successfully:', response);
      return { success: true, message: 'Email sent successfully' };
    } catch (error) {
      console.error('❌ Error sending customer email:', error);
      return { success: false, error: error.message };
    }
  },

  // Email 2: Booking Request to Selected Therapist (WORKING)
  async sendTherapistBookingRequest(bookingData, therapistData, timeoutMinutes) {
    console.log('📧 Sending therapist booking request...', { bookingData, therapistData, timeoutMinutes });
    
    if (typeof emailjs === 'undefined') {
      console.error('❌ EmailJS not loaded');
      return { success: false, error: 'EmailJS not loaded' };
    }
    
    try {
      const baseUrl = window.location.origin;
      const acceptUrl = `${baseUrl}/.netlify/functions/booking-response?action=accept&booking=${bookingData.booking_id}&therapist=${therapistData.id}`;
      const declineUrl = `${baseUrl}/.netlify/functions/booking-response?action=decline&booking=${bookingData.booking_id}&therapist=${therapistData.id}`;
      
      const therapistFee = bookingData.therapist_fee ? `$${parseFloat(bookingData.therapist_fee).toFixed(2)}` : 'TBD';
      const clientPhone = bookingData.customer_phone || 'Not provided';
      
      let bookingTypeDisplay = bookingData.booking_type || 'Standard Booking';
      if (bookingTypeDisplay === 'Hotel/Accommodation') {
        bookingTypeDisplay = '🏨 Hotel/Accommodation';
      } else if (bookingTypeDisplay === 'In-home') {
        bookingTypeDisplay = '🏠 In-Home Service';
      } else if (bookingTypeDisplay === 'Corporate Event/Office') {
        bookingTypeDisplay = '🏢 Corporate/Office';
      }
      
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

  // Email 3: Booking Confirmation to Client (when therapist accepts) - FIXED
  async sendClientConfirmationEmail(bookingData, therapistData) {
    console.log('📧 Sending client confirmation email...', { bookingData, therapistData });
    
    try {
      // FIXED: Parameters to match booking-confirmed.html template
      const templateParams = {
        to_email: bookingData.customer_email || bookingData.email,
        to_name: `${bookingData.first_name} ${bookingData.last_name}`,
        customer_name: `${bookingData.first_name} ${bookingData.last_name}`,
        booking_id: bookingData.booking_id,
        service: bookingData.services?.name || bookingData.service_name || 'Massage Service',
        duration: `${bookingData.duration_minutes} minutes`,
        date_time: new Date(bookingData.booking_time).toLocaleString(),
        address: bookingData.address,
        room_number: bookingData.room_number || 'N/A',
        therapist: `${therapistData.first_name} ${therapistData.last_name}`,
        estimated_price: bookingData.price ? `$${bookingData.price.toFixed(2)}` : 'N/A'
      };

      const result = await sendEmailViaAPI(EMAILJS_BOOKING_CONFIRMED_TEMPLATE_ID, templateParams);
      console.log('✅ Client confirmation email sent:', result);
      return { success: true, message: 'Client confirmation email sent successfully' };
    } catch (error) {
      console.error('❌ Error sending client confirmation email:', error);
      return { success: false, error: error.message };
    }
  },

  // Email 4: Booking Confirmation to Therapist (when therapist accepts) - FIXED
  async sendTherapistConfirmationEmail(bookingData, therapistData) {
    console.log('📧 Sending therapist confirmation email...', { bookingData, therapistData });
    
    try {
      // FIXED: Parameters to match therapist-confirmed.html template
      const templateParams = {
        to_email: therapistData.email,
        to_name: `${therapistData.first_name} ${therapistData.last_name}`,
        booking_id: bookingData.booking_id,
        client_name: `${bookingData.first_name} ${bookingData.last_name}`,
        client_phone: bookingData.customer_phone || 'Not provided',
        client_email: bookingData.customer_email || bookingData.email,
        service_name: bookingData.services?.name || bookingData.service_name || 'Massage Service',
        duration: `${bookingData.duration_minutes} minutes`,
        booking_date: new Date(bookingData.booking_time).toLocaleDateString(),
        booking_time: new Date(bookingData.booking_time).toLocaleTimeString(),
        address: bookingData.address,
        room_number: bookingData.room_number || 'N/A',
        therapist_fee: bookingData.therapist_fee ? `$${bookingData.therapist_fee.toFixed(2)}` : 'TBD'
      };

      const result = await sendEmailViaAPI(EMAILJS_THERAPIST_CONFIRMED_TEMPLATE_ID, templateParams);
      console.log('✅ Therapist confirmation email sent:', result);
      return { success: true, message: 'Therapist confirmation email sent successfully' };
    } catch (error) {
      console.error('❌ Error sending therapist confirmation email:', error);
      return { success: false, error: error.message };
    }
  },

  // Email 5: "Looking for Alternate" to Client (when therapist declines) - FIXED
  async sendClientLookingForAlternateEmail(bookingData) {
    console.log('📧 Sending "looking for alternate" email to client...', bookingData);
    
    try {
      // FIXED: Parameters to match looking-alternate.html template
      const templateParams = {
        to_email: bookingData.customer_email || bookingData.email,
        to_name: `${bookingData.first_name} ${bookingData.last_name}`,
        customer_name: `${bookingData.first_name} ${bookingData.last_name}`,
        booking_id: bookingData.booking_id,
        service: bookingData.services?.name || bookingData.service_name || 'Massage Service',
        duration: `${bookingData.duration_minutes} minutes`,
        date_time: new Date(bookingData.booking_time).toLocaleString(),
        address: bookingData.address
      };

      const result = await sendEmailViaAPI(EMAILJS_LOOKING_ALTERNATE_TEMPLATE_ID, templateParams);
      console.log('✅ "Looking for alternate" email sent:', result);
      return { success: true, message: 'Looking for alternate email sent successfully' };
    } catch (error) {
      console.error('❌ Error sending looking for alternate email:', error);
      return { success: false, error: error.message };
    }
  },

  // Email 6: Booking Declined to Client (when no therapist accepts) - FIXED
  async sendClientDeclineEmail(bookingData) {
    console.log('📧 Sending booking declined email to client...', bookingData);
    
    try {
      // FIXED: Parameters to match booking-declined.html template
      const templateParams = {
        to_email: bookingData.customer_email || bookingData.email,
        to_name: `${bookingData.first_name} ${bookingData.last_name}`,
        customer_name: `${bookingData.first_name} ${bookingData.last_name}`,
        booking_id: bookingData.booking_id,
        service: bookingData.services?.name || bookingData.service_name || 'Massage Service',
        duration: `${bookingData.duration_minutes} minutes`,
        date_time: new Date(bookingData.booking_time).toLocaleString(),
        address: bookingData.address
      };

      const result = await sendEmailViaAPI(EMAILJS_BOOKING_DECLINED_TEMPLATE_ID, templateParams);
      console.log('✅ Booking declined email sent:', result);
      return { success: true, message: 'Booking declined email sent successfully' };
    } catch (error) {
      console.error('❌ Error sending booking declined email:', error);
      return { success: false, error: error.message };
    }
  }
};

// Export the sendEmailViaAPI function for use in Netlify functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EmailService, sendEmailViaAPI };
}

// Export for use in browser
window.EmailService = EmailService;
window.sendEmailViaAPI = sendEmailViaAPI;
