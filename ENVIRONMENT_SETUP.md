# Environment Variables Setup Guide

## 🏠 Local Development

### 1. Create Local Environment File
Copy the example file and create your local environment file:
```bash
cp env.example env.local
```

### 2. Update Your Local Values
Edit `env.local` with your actual values:
```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# EmailJS Configuration
EMAILJS_SERVICE_ID=your_emailjs_service_id
EMAILJS_TEMPLATE_ID=your_emailjs_template_id
EMAILJS_PUBLIC_KEY=your_emailjs_public_key

# Google Maps API Key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Stripe Configuration (if using)
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
```

## ☁️ Netlify Deployment

### 1. Add Environment Variables in Netlify
1. Go to your Netlify site dashboard
2. Navigate to **Site settings** → **Build & deploy** → **Environment**
3. Click **"Edit variables"**
4. Add each variable from your `env.local` file:

| Variable Name | Value |
|---------------|-------|
| `SUPABASE_URL` | `https://dcukfurezlkagvvwgsgr.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `EMAILJS_SERVICE_ID` | `service_puww2kb` |
| `EMAILJS_TEMPLATE_ID` | `template_zh8jess` |
| `EMAILJS_PUBLIC_KEY` | `V8qq2pjH8vfh3a6q3` |
| `GOOGLE_MAPS_API_KEY` | Your Google Maps API key |
| `URL` | Your Netlify site URL (e.g., `https://your-site.netlify.app`) |

### 2. Redeploy After Adding Variables
- Go to **Deploys** tab
- Click **"Trigger deploy"** → **"Deploy site"**

## 🔒 Security Notes

- **Never commit `.env` or `env.local` files** to Git
- **Use different API keys** for development and production
- **Rotate keys regularly** for security
- **The `URL` variable** is automatically set by Netlify in production

## 🚀 Current Configuration

Your current setup uses these values:
- **Supabase URL:** `https://dcukfurezlkagvvwgsgr.supabase.co`
- **EmailJS Service:** `service_puww2kb`
- **EmailJS Template:** `template_zh8jess`
- **EmailJS Public Key:** `V8qq2pjH8vfh3a6q3` 