#!/bin/bash
set -e

APP_PATH="/Applications/CertificateReminder.app"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_ARCHIVE="$SCRIPT_DIR/CertificateReminder.app.tar.gz"

if [ ! -f "$APP_ARCHIVE" ]; then
    echo "Missing app archive: $APP_ARCHIVE" >&2
    exit 1
fi

/bin/rm -rf "$APP_PATH"
/bin/mkdir -p /Applications
/usr/bin/tar -xzf "$APP_ARCHIVE" -C /Applications

/usr/bin/xattr -cr "$APP_PATH" >/dev/null 2>&1 || true
/usr/bin/codesign --force --deep --sign - "$APP_PATH" >/dev/null 2>&1 || true

CONSOLE_USER="$(/usr/bin/stat -f %Su /dev/console)"
if [ -n "$CONSOLE_USER" ] && [ "$CONSOLE_USER" != "root" ]; then
    USER_ID="$(/usr/bin/id -u "$CONSOLE_USER")"
    /bin/launchctl asuser "$USER_ID" /usr/bin/sudo -u "$CONSOLE_USER" /usr/bin/open "$APP_PATH" >/dev/null 2>&1 || true
    sleep 2
    /bin/launchctl asuser "$USER_ID" /usr/bin/sudo -u "$CONSOLE_USER" /usr/bin/open "http://localhost:3030" >/dev/null 2>&1 || true
else
    /usr/bin/open "$APP_PATH" >/dev/null 2>&1 || true
    sleep 2
    /usr/bin/open "http://localhost:3030" >/dev/null 2>&1 || true
fi

exit 0
