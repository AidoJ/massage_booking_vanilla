// Supabase client setup for browser (UMD)
// Note: For frontend, we still need to use the actual values since environment variables
// are not available in the browser. In production, these should be injected during build.
window.supabase = supabase.createClient(
  'https://dcukfurezlkagvvwgsgr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjdWtmdXJlemxrYWd2dndnc2dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE5MjM0NjQsImV4cCI6MjA2NzQ5OTQ2NH0.ThXQKNHj0XpSkPa--ghmuRXFJ7nfcf0YVlH0liHofFw'
); 