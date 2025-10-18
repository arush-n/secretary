#!/bin/bash

# Secretary - Quick Start Script

echo "🚀 Starting Secretary Finance Assistant..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

echo "✅ Starting development server..."
echo ""
echo "🌐 Open http://localhost:3000 in your browser"
echo "📖 Click 'Open Demo' to see the dashboard"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev
