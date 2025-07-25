// Build script to inject environment variables into frontend code
const fs = require('fs');
const path = require('path');

console.log('🔧 Injecting environment variables into frontend code...');

// Read environment variables
const envVars = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  EMAILJS_SERVICE_ID: process.env.EMAILJS_SERVICE_ID,
  EMAILJS_TEMPLATE_ID: process.env.EMAILJS_TEMPLATE_ID,
  EMAILJS_PUBLIC_KEY: process.env.EMAILJS_PUBLIC_KEY,
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY
};

// Update supabaseClient.js with environment variables
const supabaseClientPath = path.join(__dirname, 'js', 'supabaseClient.js');
let supabaseClientContent = fs.readFileSync(supabaseClientPath, 'utf8');

// Replace hardcoded values with environment variables
supabaseClientContent = supabaseClientContent.replace(
  /'https:\/\/dcukfurezlkagvvwgsgr\.supabase\.co'/,
  `'${envVars.SUPABASE_URL || 'https://dcukfurezlkagvvwgsgr.supabase.co'}'`
);

supabaseClientContent = supabaseClientContent.replace(
  /'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjdWtmdXJlemxrYWd2dndnc2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MjM0NjQsImV4cCI6MjA2NzQ5OTQ2NH0\.ThXQKNHj0XpSkPa--ghmuRXFJ7nfcf0YVlH0liHofFw'/,
  `'${envVars.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjdWtmdXJlemxrYWd2dndnc2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MjM0NjQsImV4cCI6MjA2NzQ5OTQ2NH0.ThXQKNHj0XpSkPa--ghmuRXFJ7nfcf0YVlH0liHofFw'}'`
);

fs.writeFileSync(supabaseClientPath, supabaseClientContent);

// Update emailService.js with environment variables
const emailServicePath = path.join(__dirname, 'js', 'emailService.js');
let emailServiceContent = fs.readFileSync(emailServicePath, 'utf8');

// Replace hardcoded EmailJS values with environment variables
emailServiceContent = emailServiceContent.replace(
  /let EMAILJS_SERVICE_ID = '[^']*'/,
  `let EMAILJS_SERVICE_ID = '${envVars.EMAILJS_SERVICE_ID || 'service_puww2kb'}'`
);

emailServiceContent = emailServiceContent.replace(
  /let EMAILJS_TEMPLATE_ID = '[^']*'/,
  `let EMAILJS_TEMPLATE_ID = '${envVars.EMAILJS_TEMPLATE_ID || 'template_zqjm4om'}'`
);

emailServiceContent = emailServiceContent.replace(
  /let EMAILJS_PUBLIC_KEY = '[^']*'/,
  `let EMAILJS_PUBLIC_KEY = '${envVars.EMAILJS_PUBLIC_KEY || 'qfM_qA664E4JddSMN'}'`
);

fs.writeFileSync(emailServicePath, emailServiceContent);

console.log('✅ Environment variables injected successfully!'); 