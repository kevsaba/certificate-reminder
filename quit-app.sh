#!/bin/bash

# Certificate Reminder - Quit Helper
# Use this if the app gets stuck and won't quit

echo "Killing Certificate Reminder processes..."

# Kill any Bun processes running our backend
pkill -9 -f "bun run backend" 2>/dev/null
pkill -9 -f "certificate-reminder" 2>/dev/null

# Kill anything on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null

# Kill any Safari windows on localhost:3030
osascript -e 'tell application "Safari"
    repeat with w in windows
        if URL of w is "http://localhost:3030" then
            close w
        end if
    end repeat
end tell' 2>/dev/null

echo "✓ All Certificate Reminder processes killed"
echo "You can now safely relaunch the app."
