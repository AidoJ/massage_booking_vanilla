// Ultra simple webhook to test basic connectivity
exports.handler = async (event, context) => {
  console.log('🧪 SIMPLE TEST: SMS webhook called');
  console.log('📥 Method:', event.httpMethod);
  console.log('📥 Body:', event.body);
  
  // Parse the SMS data
  try {
    const params = new URLSearchParams(event.body || '');
    const fromPhone = params.get('From');
    const messageBody = params.get('Body');
    
    console.log('📱 From:', fromPhone);
    console.log('📄 Message:', messageBody);
    
    // Send a simple test response
    if (messageBody && messageBody.toUpperCase().includes('ACCEPT')) {
      console.log('✅ Detected ACCEPT message');
      
      // Send simple SMS response
      try {
        const smsResponse = await fetch('https://rmmbookingplatform.netlify.app/.netlify/functions/send-sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            phone: fromPhone, 
            message: '✅ TEST: Got your ACCEPT message! System is working.' 
          })
        });
        
        const smsResult = await smsResponse.json();
        console.log('📱 SMS Response:', smsResult);
      } catch (smsError) {
        console.error('❌ SMS Error:', smsError);
      }
    }
    
  } catch (parseError) {
    console.error('❌ Parse Error:', parseError);
  }
  
  // Always return 200 success
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
    body: 'OK'
  };
};
