#!/bin/bash
# Certificate Reminder Launcher
# Opens the app and automatically launches the browser

APP_PATH="/Applications/CertificateReminder.app"
BROWSER_URL="http://localhost:3030"

echo "🚀 Launching Certificate Reminder..."

# Check if app is installed
if [ ! -d "$APP_PATH" ]; then
    echo "❌ Certificate Reminder is not installed in /Applications"
    echo "Please drag 'CertificateReminder.app' to your Applications folder first"
    read -p "Press Enter to exit"
    exit 1
fi

# Launch the app (this starts the backend server)
open "$APP_PATH"

# Wait for server to be ready
echo "⏳ Waiting for server to start..."
for i in {1..20}; do
    if curl -s "$BROWSER_URL" > /dev/null 2>&1; then
        echo "✅ Server is ready!"
        break
    fi
    if [ $i -eq 20 ]; then
        echo "⚠️ Server didn't start within 10 seconds"
        echo "The app should be running - try opening $BROWSER_URL manually"
    fi
    sleep 0.5
done

# Open in default browser
echo "🌐 Opening browser..."
open "$BROWSER_URL"

echo ""
echo "✨ Certificate Reminder is now running!"
echo ""
echo "To quit the app:"
echo "  - Click the 'Close App' button in the browser"
echo "  - Or use Command+Q when the app window is focused"
echo "  - Or run: ./quit-app.sh"
echo ""
read -p "Press Enter to close this window (the app will keep running)"
