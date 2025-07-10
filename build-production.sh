#!/bin/bash

# Production Deployment Script with Environment Variable Injection
# This script builds the app and injects environment variables at build time

set -e

echo "🏗️ Building TradingRoad AI for production..."

# Check if environment variables are set
if [ -z "$VITE_GEMINI_API_KEY" ] && [ -z "$GEMINI_API_KEY" ] && [ -z "$API_KEY" ]; then
    echo "⚠️  Warning: No Gemini API key found in environment variables"
    echo "   Please set VITE_GEMINI_API_KEY, GEMINI_API_KEY, or API_KEY"
    echo "   The app will build but AI features will be disabled"
fi

# Load .env file if it exists
if [ -f ".env" ]; then
    echo "📄 Loading environment variables from .env file..."
    export $(cat .env | grep -v '^#' | xargs)
fi

# Build the application
echo "🔨 Running build..."
npm run build

# Inject environment variables into the built HTML
if [ -n "$VITE_GEMINI_API_KEY" ] || [ -n "$GEMINI_API_KEY" ] || [ -n "$API_KEY" ]; then
    API_KEY_VALUE="${VITE_GEMINI_API_KEY:-${GEMINI_API_KEY:-$API_KEY}}"
    echo "🔧 Injecting API key into built files..."
    
    # Replace the placeholder in the built HTML file
    if [ -f "dist/index.html" ]; then
        sed -i.bak "s/TU_CLAVE_API_DE_GEMINI_AQUI/$API_KEY_VALUE/g" dist/index.html
        rm dist/index.html.bak
        echo "✅ API key injected successfully"
    fi
fi

echo "🎉 Build completed successfully!"
echo "📁 Built files are in the 'dist' directory"
echo ""
echo "📋 Next steps:"
echo "   1. Upload the 'dist' directory contents to your web server"
echo "   2. Configure your web server to serve the index.html for all routes"
echo "   3. Ensure HTTPS is enabled for proper API access"
echo ""
echo "🌐 If deploying to AWS:"
echo "   - Use the deploy-ec2.sh script for EC2 deployment"
echo "   - Or use deploy-apprunner.sh for AWS App Runner deployment"
