#!/bin/bash
set -e

# Certificate Reminder - DMG Build Script
# Builds the app and creates a DMG with quarantine attributes removed

APP_NAME="CertificateReminder"
VERSION="9.0.0"
DMG_NAME="${APP_NAME}-${VERSION}-macOS.dmg"
PKG_NAME="${APP_NAME}-${VERSION}-macOS.pkg"

echo "🔨 Building $APP_NAME v$VERSION..."
echo ""

# Step 1: Build the UI
echo "Step 1: Building UI..."
bun run build
echo "✅ UI built"
echo ""

# Step 2: Build the app with Electrobun
echo "Step 2: Building app bundle..."
export PATH="$HOME/.bun/bin:$PATH"
bun install && electrobun build --env=canary

# Find the built app
APP_BUNDLE=$(find build/canary-macos-arm64 -name "*.app" -maxdepth 1 | head -1)
if [ -z "$APP_BUNDLE" ]; then
    echo "❌ Error: App bundle not found in build/canary-macos-arm64"
    exit 1
fi

# Get just the app name
APP_FILENAME=$(basename "$APP_BUNDLE")
echo "✅ App bundle built: $APP_FILENAME"
echo ""

# Step 3: Copy icon to app bundle
echo "Step 3: Adding custom icon..."
if [ -f "CertificateReminder.icns" ]; then
    mkdir -p "$APP_BUNDLE/Contents/Resources"
    cp CertificateReminder.icns "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
    # Touch the app bundle to force icon cache refresh
    touch "$APP_BUNDLE"
    # Set the icon flag on the bundle
    SetFile -a C "$APP_BUNDLE" 2>/dev/null || echo "SetFile not available, skipping"
    echo "✅ Icon copied to app bundle and cache refresh triggered"
else
    echo "⚠️  Warning: CertificateReminder.icns not found, using default icon"
fi
echo ""

# Step 4: Remove quarantine attributes from app bundle
echo "Step 4: Removing quarantine attributes..."
if [ -d "$APP_BUNDLE" ]; then
    xattr -cr "$APP_BUNDLE"
    echo "✅ Quarantine attributes removed from app bundle"
else
    echo "❌ Error: App bundle not found at $APP_BUNDLE"
    exit 1
fi
echo ""

# Step 5: Copy to distribution folder
echo "Step 5: Preparing distribution..."
DIST_DIR="CertificateReminder-Distribution"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# Copy and rename app bundle
cp -R "$APP_BUNDLE" "$DIST_DIR/$APP_NAME.app"
# Ensure the bundle bit is set (critical for icon display)
SetFile -a B "$DIST_DIR/$APP_NAME.app" 2>/dev/null || true
# Touch the bundle to force icon cache refresh
touch "$DIST_DIR/$APP_NAME.app"
echo "✅ App bundle copied to distribution folder"
echo ""

# Step 6: Copy documentation and examples
echo "Step 6: Adding documentation..."
cp DISTRIBUTION_README.md "$DIST_DIR/README.md" 2>/dev/null || echo "DISTRIBUTION_README.md not found, skipping"
cp USER_GUIDE.md "$DIST_DIR/" 2>/dev/null || echo "USER_GUIDE.md not found, skipping"
if [ -d "examples" ]; then
    cp -r examples "$DIST_DIR/"
elif [ -d "../examples" ]; then
    cp -r ../examples "$DIST_DIR/"
else
    echo "examples folder not found, skipping"
fi
cp quit-app.sh "$DIST_DIR/"
cp launch-app.command "$DIST_DIR/"
cp refresh-icon.command "$DIST_DIR/"
echo "✅ Documentation added"
echo ""

# Step 7: Create DMG
echo "Step 7: Creating DMG..."
DMG_PATH="artifacts/$DMG_NAME"
PKG_PATH="artifacts/$PKG_NAME"
rm -f "$DMG_PATH"
rm -f "$PKG_PATH"
mkdir -p artifacts

# Create temporary DMG
hdiutil create -volname "$APP_NAME" \
    -srcfolder "$DIST_DIR" \
    -ov -format UDZO \
    "$DMG_PATH"

# Remove quarantine from DMG itself
xattr -cr "$DMG_PATH"

echo "✅ DMG created: $DMG_PATH"
echo ""

# Step 8: Create PKG installer
echo "Step 8: Creating PKG installer..."
PKG_SCRIPTS_DIR="$(mktemp -d)"
PKG_STAGE_DIR="$(mktemp -d)"
cp pkg-postinstall.sh "$PKG_SCRIPTS_DIR/postinstall"
chmod +x "$PKG_SCRIPTS_DIR/postinstall"
ditto --norsrc --noextattr "$DIST_DIR/$APP_NAME.app" "$PKG_STAGE_DIR/$APP_NAME.app"
COPYFILE_DISABLE=1 pkgbuild \
    --component "$PKG_STAGE_DIR/$APP_NAME.app" \
    --install-location "/Applications" \
    --identifier "com.certificates.reminder" \
    --version "$VERSION" \
    --scripts "$PKG_SCRIPTS_DIR" \
    "$PKG_PATH"
rm -rf "$PKG_SCRIPTS_DIR"
rm -rf "$PKG_STAGE_DIR"
xattr -cr "$PKG_PATH"
echo "✅ PKG created: $PKG_PATH"
echo ""

# Step 9: Copy installer wrapper script to artifacts
echo "Step 9: Adding installer wrapper script..."
if [ -f "Install-CertificateReminder.command" ]; then
    cp Install-CertificateReminder.command artifacts/
    chmod +x artifacts/Install-CertificateReminder.command
    echo "✅ Installer script copied to artifacts/"
else
    echo "⚠️  Warning: Install-CertificateReminder.command not found"
fi
if [ -f "installer-app-launcher.sh" ]; then
    INSTALLER_APP="artifacts/Install CertificateReminder.app"
    rm -rf "$INSTALLER_APP"
    mkdir -p "$INSTALLER_APP/Contents/MacOS" "$INSTALLER_APP/Contents/Resources"
    cp installer-app-launcher.sh "$INSTALLER_APP/Contents/MacOS/install-certificate-reminder"
    chmod +x "$INSTALLER_APP/Contents/MacOS/install-certificate-reminder"
    cat > "$INSTALLER_APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>install-certificate-reminder</string>
    <key>CFBundleIdentifier</key>
    <string>com.certificates.reminder.installer</string>
    <key>CFBundleName</key>
    <string>Install CertificateReminder</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>9.0.0</string>
    <key>CFBundleVersion</key>
    <string>9.0.0</string>
</dict>
</plist>
PLIST
    xattr -cr "$INSTALLER_APP"
    echo "✅ Installer app created in artifacts/"
else
    echo "⚠️  Warning: installer-app-launcher.sh not found"
fi
echo ""

echo "🎉 Build complete!"
echo ""
echo "Output files:"
echo "  - DMG: $DMG_PATH"
echo "  - PKG: $PKG_PATH"
echo "  - Installer app: artifacts/Install CertificateReminder.app"
echo "  - Installer: artifacts/Install-CertificateReminder.command"
echo "  - Distribution: $DIST_DIR"
echo ""
echo "To distribute:"
echo "  1. Send these files to users:"
echo "     - CertificateReminder-9.0.0-macOS.pkg"
echo "     - CertificateReminder-9.0.0-macOS.dmg"
echo "     - Install CertificateReminder.app"
echo "     - Install-CertificateReminder.command"
echo "  2. Tell users to double-click CertificateReminder-9.0.0-macOS.pkg"
echo "  3. macOS Installer will install CertificateReminder and open localhost:3030"
