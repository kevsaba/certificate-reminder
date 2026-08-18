#!/bin/bash
# Certificate Reminder - Icon Refresh Script
# Run this if the app icon doesn't display correctly after installation

echo "🔄 Refreshing CertificateReminder icon..."
echo ""

APP_PATH="/Applications/CertificateReminder.app"

# Check if app is installed
if [ ! -d "$APP_PATH" ]; then
    echo "❌ CertificateReminder.app not found in /Applications"
    echo "   Please install the app first, then run this script again."
    echo ""
    exit 1
fi

echo "✅ Found CertificateReminder.app"
echo ""

# Step 1: Kill the Dock to refresh icon cache
echo "Step 1: Refreshing Dock icon cache..."
killall Dock 2>/dev/null
echo "✅ Dock refreshed"
echo ""

# Step 2: Touch the app bundle to force update
echo "Step 2: Updating app bundle timestamp..."
touch "$APP_PATH"
echo "✅ App bundle updated"
echo ""

# Step 3: Clear icon cache
echo "Step 3: Clearing icon cache..."
rm -rf ~/Library/Caches/com.apple.iconservices/*
rm -rf ~/Library/Caches/com.apple.dock.iconcache.*
echo "✅ Icon cache cleared"
echo ""

echo "🎉 Icon refresh complete!"
echo ""
echo "If the icon still doesn't show correctly:"
echo "1. Quit CertificateReminder if it's running"
echo "2. Run this script again"
echo "3. Launch CertificateReminder from Applications"
echo ""
