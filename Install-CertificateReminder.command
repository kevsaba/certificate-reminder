#!/bin/bash
# Certificate Reminder Installer v9.0.0
# Removes quarantine attributes and opens DMG

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

# Open the DMG
echo -e "${YELLOW}📀 Opening disk image...${NC}"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "In the window that opens:"
echo "  1. Drag CertificateReminder.app to Applications"
echo "  2. Wait for copy to complete"
echo "  3. Eject the disk (drag to Trash)"
echo "  4. Open CertificateReminder from Applications"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

open "$DMG_PATH"

echo -e "${BLUE}🎉 Installation started!${NC}"
echo ""
echo "After installing, you can delete this installer and the DMG."
echo ""
read -p "Press Enter to close this window..."
