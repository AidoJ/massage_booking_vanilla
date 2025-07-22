#!/bin/bash

# Netlify Environment Variables Setup Script
# This script reads env.example and sets the variables in Netlify

echo "🚀 Setting up Netlify environment variables..."

# Check if Netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo "❌ Netlify CLI not found. Please install it first:"
    echo "npm install -g netlify-cli"
    exit 1
fi

# Check if user is logged in to Netlify
if ! netlify status &> /dev/null; then
    echo "❌ Not logged in to Netlify. Please run:"
    echo "netlify login"
    exit 1
fi

# Read env.example and set each variable
while IFS='=' read -r key value; do
    # Skip comments and empty lines
    if [[ $key =~ ^#.*$ ]] || [[ -z $key ]]; then
        continue
    fi
    
    # Remove quotes from value if present
    value=$(echo $value | sed 's/^"//;s/"$//')
    
    echo "Setting $key..."
    netlify env:set $key "$value"
done < env.example

echo "✅ Environment variables set successfully!"
echo "🔄 Triggering a new deploy..."
netlify deploy --prod 