#!/bin/bash
set -e

APP_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
LOG_FILE="/tmp/CertificateReminder-v9-install.log"
DMG_NAME="CertificateReminder-9.0.0-macOS.dmg"
DMG_PATH="$APP_DIR/$DMG_NAME"
APP_NAME="CertificateReminder.app"
APP_DEST="/Applications/$APP_NAME"
MOUNT_PATH=""

handle_error() {
    {
        echo ""
        echo "Installation failed."
        echo "Folder: $APP_DIR"
        echo "Expected DMG: $DMG_PATH"
    } >>"$LOG_FILE"
    open -a TextEdit "$LOG_FILE" >/dev/null 2>&1 || open "$LOG_FILE" >/dev/null 2>&1 || true
}
trap handle_error ERR

cleanup() {
    if [ -n "$MOUNT_PATH" ] && [ -d "$MOUNT_PATH" ]; then
        hdiutil detach "$MOUNT_PATH" >>"$LOG_FILE" 2>&1 || true
    fi
}
trap cleanup EXIT

{
    echo "CertificateReminder v9.0.0 installer"
    echo "Folder: $APP_DIR"
    echo "Started: $(date)"
} >"$LOG_FILE"

if [ ! -f "$DMG_PATH" ]; then
    echo "Cannot find $DMG_NAME next to the installer app." >>"$LOG_FILE"
    false
fi

echo "Clearing DMG quarantine..." >>"$LOG_FILE"
xattr -cr "$DMG_PATH" >>"$LOG_FILE" 2>&1 || true

echo "Mounting DMG..." >>"$LOG_FILE"
ATTACH_OUTPUT="$(hdiutil attach "$DMG_PATH" -nobrowse)"
echo "$ATTACH_OUTPUT" >>"$LOG_FILE"
MOUNT_PATH="$(printf '%s\n' "$ATTACH_OUTPUT" | awk -F'\t' '/\/Volumes\/CertificateReminder/ {print $NF; exit}')"

if [ -z "$MOUNT_PATH" ] || [ ! -d "$MOUNT_PATH/$APP_NAME" ]; then
    echo "Could not find $APP_NAME inside the mounted disk image." >>"$LOG_FILE"
    false
fi

echo "Installing to $APP_DEST..." >>"$LOG_FILE"
if [ -e "$APP_DEST" ]; then
    rm -rf "$APP_DEST" >>"$LOG_FILE" 2>&1
fi

cp -R "$MOUNT_PATH/$APP_NAME" "$APP_DEST" >>"$LOG_FILE" 2>&1
xattr -cr "$APP_DEST" >>"$LOG_FILE" 2>&1 || true

echo "Launching CertificateReminder..." >>"$LOG_FILE"
open "$APP_DEST" >>"$LOG_FILE" 2>&1

sleep 2
open "http://localhost:3030" >>"$LOG_FILE" 2>&1 || true
echo "Installation complete." >>"$LOG_FILE"
