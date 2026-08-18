#!/bin/bash
# Certificate Reminder Installer v9.0.0
# Installs the app from the DMG, clears quarantine attributes, and launches it

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Certificate Reminder v9.0.0 - Installer     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# DMG filename (must match)
DMG_NAME="CertificateReminder-9.0.0-macOS.dmg"
DMG_PATH="$SCRIPT_DIR/$DMG_NAME"

# Check if DMG exists
if [ ! -f "$DMG_PATH" ]; then
    echo -e "${RED}❌ Error: Cannot find $DMG_NAME${NC}"
    echo ""
    echo "Please make sure:"
    echo "  1. Both this installer AND $DMG_NAME are in the SAME folder"
    echo "  2. You downloaded both files from the same source"
    echo ""
    echo "Current location: $SCRIPT_DIR"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo -e "${GREEN}✅ Found: $DMG_NAME${NC}"
echo ""

# Remove quarantine attributes from DMG
echo -e "${YELLOW}🔧 Removing quarantine attributes...${NC}"
if xattr -cr "$DMG_PATH" 2>/dev/null; then
    echo -e "${GREEN}✅ Quarantine removed successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: Could not remove quarantine (may not be needed)${NC}"
fi
echo ""

APP_NAME="CertificateReminder.app"
APP_DEST="/Applications/$APP_NAME"
MOUNT_PATH=""

cleanup() {
    if [ -n "$MOUNT_PATH" ] && [ -d "$MOUNT_PATH" ]; then
        hdiutil detach "$MOUNT_PATH" >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT

echo -e "${YELLOW}📀 Mounting disk image...${NC}"
ATTACH_OUTPUT="$(hdiutil attach "$DMG_PATH" -nobrowse)"
MOUNT_PATH="$(printf '%s\n' "$ATTACH_OUTPUT" | awk -F'\t' '/\/Volumes\/CertificateReminder/ {print $NF; exit}')"

if [ -z "$MOUNT_PATH" ] || [ ! -d "$MOUNT_PATH/$APP_NAME" ]; then
    echo -e "${RED}❌ Error: Could not find $APP_NAME inside the mounted disk image${NC}"
    echo ""
    echo "$ATTACH_OUTPUT"
    echo ""
    read -p "Press Enter to exit..."
    exit 1
fi

echo -e "${GREEN}✅ Mounted: $MOUNT_PATH${NC}"
echo ""

echo -e "${YELLOW}📦 Installing to Applications...${NC}"

if [ -e "$APP_DEST" ]; then
    echo "Removing previous CertificateReminder installation..."
    if ! rm -rf "$APP_DEST" 2>/dev/null; then
        osascript -e 'do shell script "rm -rf /Applications/CertificateReminder.app" with administrator privileges'
    fi
fi

if ! cp -R "$MOUNT_PATH/$APP_NAME" "$APP_DEST" 2>/dev/null; then
    osascript -e 'do shell script "cp -R \"'"$MOUNT_PATH"'/'"$APP_NAME"'\" /Applications/" with administrator privileges'
fi

echo -e "${GREEN}✅ Installed: $APP_DEST${NC}"
echo ""

echo -e "${YELLOW}🔧 Clearing app quarantine attributes...${NC}"
if xattr -cr "$APP_DEST" 2>/dev/null; then
    echo -e "${GREEN}✅ App quarantine removed successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: Could not clear app quarantine automatically${NC}"
fi
echo ""

echo -e "${YELLOW}🚀 Launching CertificateReminder...${NC}"
open "$APP_DEST"

sleep 2
open "http://localhost:3030" >/dev/null 2>&1 || true

echo -e "${BLUE}🎉 Installation complete!${NC}"
echo ""
echo "CertificateReminder v9.0.0 was installed in Applications."
echo "If the browser did not open, go to: http://localhost:3030"
echo ""
echo "After installing, you can delete this folder."
echo ""
read -p "Press Enter to close this window..."
