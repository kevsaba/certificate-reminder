#!/bin/bash
set -e

APP_PATH="/Applications/CertificateReminder.app"

if [ -d "$APP_PATH" ]; then
    /usr/bin/xattr -cr "$APP_PATH" >/dev/null 2>&1 || true
    /usr/bin/open "$APP_PATH" >/dev/null 2>&1 || true
    sleep 2
    /usr/bin/open "http://localhost:3030" >/dev/null 2>&1 || true
fi

exit 0
