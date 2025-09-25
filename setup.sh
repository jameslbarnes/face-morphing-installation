#!/bin/bash

echo "🎨 Face Morphing Installation Setup"
echo "=================================="

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p uploads
mkdir -p videos

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check for ffmpeg
if command -v ffmpeg &> /dev/null; then
    echo "✅ ffmpeg is installed"
else
    echo "⚠️  ffmpeg is not installed. Video concatenation may not work."
    echo "   Install with: sudo apt-get install ffmpeg (Linux) or brew install ffmpeg (Mac)"
fi

echo ""
echo "✨ Setup complete!"
echo ""
echo "To start the application:"
echo "  Development mode: npm run dev"
echo "  Production mode: npm start"
echo ""
echo "Access points:"
echo "  📸 Capture: http://localhost:3000"
echo "  📺 Display: http://localhost:3000/display.html"
echo "  🎛️  Admin: http://localhost:3000/admin.html"
echo ""
echo "Your PiAPI key is configured and ready to use!"