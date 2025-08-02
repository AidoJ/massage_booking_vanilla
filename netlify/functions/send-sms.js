const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN; 
const fromPhone = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { phone, message } = JSON.parse(event.body);

    if (!phone || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Phone and message required' })
      };
    }

    console.log('📱 Sending SMS to:', phone);
    console.log('📄 Message:', message);

    // Send SMS via Twilio
    const smsResult = await client.messages.create({
      body: message,
      from: fromPhone,
      to: phone
    });

    console.log('✅ SMS sent successfully. SID:', smsResult.sid);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        sid: smsResult.sid,
        status: smsResult.status
      })
    };

  } catch (error) {
    console.error('❌ Error sending SMS:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message 
      })
    };
  }
};
