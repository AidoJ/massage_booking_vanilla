# Deployment Guide - Massage Booking System

## 🚀 Deploy to Netlify

### Option 1: Drag & Drop (Easiest)
1. Go to [netlify.com](https://netlify.com) and sign up/login
2. Drag your entire `massage-booking-vanilla` folder to the Netlify dashboard
3. Wait for deployment to complete
4. Your site will be live at `https://random-name.netlify.app`

### Option 2: GitHub Integration (Recommended)
1. Push your code to GitHub
2. Connect your GitHub repo to Netlify
3. Netlify will automatically deploy on every push

## 📧 EmailJS Setup

### 1. Update Your EmailJS Template
Go to your EmailJS dashboard and update template `template_1qnwhwc` to handle different email types:

```html
<!-- Add this conditional logic to your template -->
{% if email_type == 'client_confirmation' %}
  <!-- Client confirmation email content -->
  <h2>📧 Booking Request Received</h2>
  <p>Hi {{to_name}}, we've got your request!</p>
  <!-- Add your client confirmation content -->

{% elif email_type == 'therapist_notification' %}
  <!-- Therapist notification email content -->
  <h2>🎉 NEW BOOKING REQUEST</h2>
  <p>You have a new client waiting for you!</p>
  
  <!-- Add Accept/Decline buttons -->
  <div style="text-align: center; margin: 20px 0;">
    <a href="{{accept_url}}" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">
      ✅ ACCEPT BOOKING
    </a>
    <a href="{{decline_url}}" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
      ❌ DECLINE
    </a>
  </div>
  
  <!-- Add your therapist notification content -->

{% elif email_type == 'client_acceptance' %}
  <!-- Client acceptance email content -->
  <h2>✅ Booking Confirmed!</h2>
  <p>Hi {{to_name}}, great news!</p>
  <!-- Add your client acceptance content -->

{% elif email_type == 'therapist_acceptance' %}
  <!-- Therapist acceptance email content -->
  <h2>✅ Booking Confirmed!</h2>
  <p>Hi {{to_name}}, you have accepted a booking!</p>
  <!-- Add your therapist acceptance content -->

{% elif email_type == 'client_decline' %}
  <!-- Client decline email content -->
  <h2>Booking Update</h2>
  <p>Hi {{to_name}}, we're looking for an alternate therapist.</p>
  <!-- Add your client decline content -->

{% elif email_type == 'client_final_decline' %}
  <!-- Client final decline email content -->
  <h2>Booking Request Declined</h2>
  <p>Hi {{to_name}}, unfortunately we couldn't find an available therapist.</p>
  <!-- Add your final decline content -->
{% endif %}
```

### 2. Test Your EmailJS Template
1. Go to EmailJS dashboard → Email Templates
2. Click on your template
3. Use the "Test" feature to send a test email
4. Verify all email types work correctly

### 3. Update Template Variables
Make sure your template includes these variables:
- `{{to_name}}` - Recipient name
- `{{to_email}}` - Recipient email
- `{{booking_id}}` - Booking ID
- `{{service_name}}` - Service name
- `{{duration}}` - Duration
- `{{date}}` - Booking date/time
- `{{address}}` - Address
- `{{room_number}}` - Room number
- `{{price}}` - Price
- `{{therapist_fee}}` - Therapist fee
- `{{accept_url}}` - Accept button URL
- `{{decline_url}}` - Decline button URL
- `{{email_type}}` - Type of email (for conditional logic)

## 🔧 Environment Variables (Optional)
If you want to use environment variables instead of hardcoded values:

1. In Netlify dashboard → Site settings → Environment variables
2. Add:
   - `SUPABASE_URL` = your Supabase URL
   - `SUPABASE_ANON_KEY` = your Supabase anon key
   - `EMAILJS_SERVICE_ID` = your EmailJS service ID
   - `EMAILJS_TEMPLATE_ID` = your EmailJS template ID
   - `EMAILJS_PUBLIC_KEY` = your EmailJS public key

## 🧪 Testing the Complete Flow

### 1. Test Booking Submission
1. Go to your live site
2. Complete a booking
3. Check that emails are sent to client and therapists

### 2. Test Accept/Decline
1. Click Accept/Decline links in therapist emails
2. Verify booking status updates in Supabase
3. Check that confirmation emails are sent

### 3. Test Timeout
1. Wait for timeout period (default 2 minutes)
2. Try to Accept/Decline after timeout
3. Verify timeout message appears

## 🐛 Troubleshooting

### Common Issues:
1. **Emails not sending**: Check EmailJS template variables
2. **Functions not working**: Verify Netlify function deployment
3. **Database errors**: Check Supabase connection
4. **CORS errors**: Verify Netlify redirects

### Debug Steps:
1. Check browser console for errors
2. Check Netlify function logs
3. Verify EmailJS template syntax
4. Test Supabase connection

## 📞 Support
If you encounter issues:
1. Check the browser console for error messages
2. Verify all environment variables are set correctly
3. Test EmailJS template with sample data
4. Check Netlify function logs in the dashboard 