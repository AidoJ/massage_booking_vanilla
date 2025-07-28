# Accept/Decline Functionality Implementation

## ✅ What Has Been Implemented

### 1. Accept/Decline Button URLs
- **Fixed URL Path**: Updated Accept/Decline URLs in `js/emailService.js` to point to the correct Netlify function path:
  - From: `/api/booking-response`
  - To: `/.netlify/functions/booking-response`

### 2. Email Templates Created
Created 4 new email templates in the `email-templates/` directory:

#### 📧 `booking-confirmed.html`
- **Purpose**: Sent to client when therapist accepts booking
- **Template ID**: `template_booking_confirmed`
- **Features**: 
  - Confirmation message with booking details
  - Therapist information
  - Important preparation instructions
  - Contact information

#### 📧 `therapist-confirmed.html`
- **Purpose**: Sent to therapist when they accept a booking
- **Template ID**: `template_therapist_confirmed`
- **Features**:
  - Booking details and client information
  - Earnings information
  - Important reminders for the session
  - Contact information

#### 📧 `booking-declined.html`
- **Purpose**: Sent to client when no alternative therapist is found
- **Template ID**: `template_booking_declined`
- **Features**:
  - Apology and explanation
  - Alternative suggestions
  - Special offer (10% discount)
  - Contact information

#### 📧 `looking-alternate.html`
- **Purpose**: Sent to client when therapist declines but alternative is being sought
- **Template ID**: `template_looking_alternate`
- **Features**:
  - Reassurance message
  - Timeline expectations
  - Booking details
  - Contact information

### 3. Email Service Updates
Updated `js/emailService.js` with new template IDs:
```javascript
let EMAILJS_BOOKING_CONFIRMED_TEMPLATE_ID = 'template_booking_confirmed';
let EMAILJS_THERAPIST_CONFIRMED_TEMPLATE_ID = 'template_therapist_confirmed';
let EMAILJS_BOOKING_DECLINED_TEMPLATE_ID = 'template_booking_declined';
let EMAILJS_LOOKING_ALTERNATE_TEMPLATE_ID = 'template_looking_alternate';
```

### 4. Netlify Function Updates
Updated `netlify/functions/booking-response.js`:

#### ✅ Email Template Integration
- Added new template ID constants
- Updated email functions to use correct templates
- Enhanced email parameters with additional fields

#### ✅ Improved Decline Logic
- **When alternative therapist found**: Sends "looking for alternate" email
- **When no alternative found**: Sends "booking declined" email
- **Fallback preference**: Respects customer's fallback preference

#### ✅ Enhanced Email Functions
- `sendClientConfirmationEmail()`: Uses booking confirmed template
- `sendTherapistConfirmationEmail()`: Uses therapist confirmed template
- `sendClientDeclineEmail()`: Uses booking declined template
- `sendClientLookingForAlternateEmail()`: Uses looking alternate template

### 5. Database Integration
The system properly handles:
- ✅ Booking status updates (`confirmed`, `declined`)
- ✅ Therapist response time tracking
- ✅ Status history logging
- ✅ Alternative therapist assignment
- ✅ Timeout validation (60 minutes default)

## 🔄 Current Flow

### Accept Flow:
1. Therapist clicks "Accept" button in email
2. Netlify function processes acceptance
3. Booking status updated to "confirmed"
4. Client receives confirmation email
5. Therapist receives confirmation email
6. Success page displayed

### Decline Flow:
1. Therapist clicks "Decline" button in email
2. Netlify function processes decline
3. **If fallback = "yes"**:
   - System looks for alternative therapist
   - **If found**: Client gets "looking for alternate" email
   - **If not found**: Client gets "booking declined" email
4. **If fallback = "no"**: Client gets "booking declined" email
5. Success page displayed

## 📋 Next Steps Required

### 1. EmailJS Template Creation
You need to create the following templates in your EmailJS dashboard:

#### Required Templates:
1. **`template_booking_confirmed`** - Copy content from `email-templates/booking-confirmed.html`
2. **`template_therapist_confirmed`** - Copy content from `email-templates/therapist-confirmed.html`
3. **`template_booking_declined`** - Copy content from `email-templates/booking-declined.html`
4. **`template_looking_alternate`** - Copy content from `email-templates/looking-alternate.html`

#### Template Variables Required:
- `{{to_name}}` - Recipient name
- `{{to_email}}` - Recipient email
- `{{customer_name}}` - Customer name
- `{{booking_id}}` - Booking ID
- `{{service}}` - Service name
- `{{duration}}` - Duration
- `{{date_time}}` - Date and time
- `{{address}}` - Address
- `{{room_number}}` - Room number
- `{{therapist}}` - Therapist name
- `{{estimated_price}}` - Estimated price
- `{{therapist_fee}}` - Therapist fee
- `{{client_name}}` - Client name
- `{{client_phone}}` - Client phone
- `{{client_email}}` - Client email

### 2. Testing
Test the complete flow:
1. **Submit a booking** → Verify therapist email is sent
2. **Click Accept button** → Verify confirmation emails sent
3. **Click Decline button** → Verify appropriate decline email sent
4. **Test timeout** → Verify timeout handling

### 3. Environment Variables (Optional)
If you want to use environment variables instead of hardcoded template IDs:

Add to Netlify environment variables:
- `EMAILJS_BOOKING_CONFIRMED_TEMPLATE_ID`
- `EMAILJS_THERAPIST_CONFIRMED_TEMPLATE_ID`
- `EMAILJS_BOOKING_DECLINED_TEMPLATE_ID`
- `EMAILJS_LOOKING_ALTERNATE_TEMPLATE_ID`

## 🚀 Deployment
1. Push all changes to your repository
2. Netlify will automatically deploy the updated function
3. Create the EmailJS templates
4. Test the complete flow

## 🐛 Troubleshooting
- **Emails not sending**: Check EmailJS template variables match
- **Function errors**: Check Netlify function logs
- **URL issues**: Verify Accept/Decline URLs are correct
- **Database errors**: Check Supabase connection and permissions

## 📞 Support
For issues, check:
1. Browser console for JavaScript errors
2. Netlify function logs
3. EmailJS dashboard for template issues
4. Supabase dashboard for database issues 