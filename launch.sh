#!/bin/bash
# Certificate Reminder Launcher v4.0.0
# This script launches the backend app and opens the browser

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Path to the backend app
APP_NAME="CertificateReminder.app"
APPLICATIONS_PATH="/Applications"
APP_PATH="$APPLICATIONS_PATH/$APP_NAME"

echo "🚀 Certificate Reminder Launcher v4.0.0"
echo "=================================="
echo ""

# Check if app exists
if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}❌ Error: App not found at $APP_PATH${NC}"
    echo ""
    echo "Please install CertificateReminder.app to your Applications folder first."
    echo ""
    read -p "Press Enter to exit"
    exit 1
fi

echo -e "${GREEN}✓ Found app at: $APP_PATH${NC}"
echo ""

# Check if already running
if pgrep -f "CertificateReminder" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Certificate Reminder is already running!${NC}"
    echo ""
    echo "Opening browser to http://localhost:3030..."
    open "http://localhost:3030"
    echo ""
    echo "To quit the app, click the 'Close App' button in the browser,"
    echo "or run: pkill -f 'CertificateReminder'"
    echo ""
    exit 0
fi

# Launch the backend app
echo "🔨 Starting backend server..."
open "$APP_PATH"

# Wait for server to be ready
echo "⏳ Waiting for server to start..."
MAX_ATTEMPTS=20
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3030" 2>&1 | grep -q "200\|404"; then
        echo -e "${GREEN}✓ Server is ready!${NC}"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    sleep 0.5
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${RED}❌ Server failed to start after 10 seconds${NC}"
    echo ""
    echo "Please check:"
    echo "  1. Activity Monitor for 'CertificateReminder' processes"
    echo "  2. Console.app for error messages"
    echo "  3. Try opening http://localhost:3030 manually in your browser"
    echo ""
    read -p "Press Enter to exit"
    exit 1
fi

# Open browser
echo ""
echo "🌐 Opening browser..."
open "http://localhost:3030"

echo ""
echo -e "${GREEN}✨ Certificate Reminder is ready!${NC}"
echo ""
echo "📝 To quit the app:"
echo "  - Click the 'Close App' button in the browser"
echo "  - Or run: pkill -f 'CertificateReminder'"
echo ""
echo "📌 The app will keep running until you quit it."
echo ""
read -p "Press Enter to close this window (the app will keep running)"
