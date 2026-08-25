#!/bin/bash
set -e

# Certificate Reminder - DMG Build Script
# Builds the app and creates a DMG with quarantine attributes removed

APP_NAME="CertificateReminder"
VERSION="9.0.0"
DMG_NAME="${APP_NAME}-${VERSION}-macOS.dmg"
PKG_NAME="${APP_NAME}-${VERSION}-macOS.pkg"
DEVELOPER_ID_APPLICATION="${DEVELOPER_ID_APPLICATION:-}"
DEVELOPER_ID_INSTALLER="${DEVELOPER_ID_INSTALLER:-}"
NOTARYTOOL_PROFILE="${NOTARYTOOL_PROFILE:-}"

sign_app_if_configured() {
    local app_path="$1"

    if [ -z "$DEVELOPER_ID_APPLICATION" ]; then
        echo "⚠️  DEVELOPER_ID_APPLICATION not set; ad-hoc signing app for local execution"
        xattr -cr "$app_path" >/dev/null 2>&1 || true
        xattr -d com.apple.FinderInfo "$app_path" >/dev/null 2>&1 || true
        codesign --force --deep --sign - "$app_path"
        codesign --verify --deep --verbose=2 "$app_path"
        echo "✅ App ad-hoc signed"
        return
    fi

    echo "🔏 Signing app with: $DEVELOPER_ID_APPLICATION"
    xattr -cr "$app_path" >/dev/null 2>&1 || true
    xattr -d com.apple.FinderInfo "$app_path" >/dev/null 2>&1 || true
    codesign --force --deep --options runtime --timestamp --sign "$DEVELOPER_ID_APPLICATION" "$app_path"
    codesign --verify --deep --strict --verbose=2 "$app_path"
    echo "✅ App signed"
}

sign_pkg_if_configured() {
    local pkg_path="$1"

    if [ -z "$DEVELOPER_ID_INSTALLER" ]; then
        echo "⚠️  DEVELOPER_ID_INSTALLER not set; PKG will not be Developer ID signed"
        return
    fi

    local signed_pkg="${pkg_path%.pkg}-signed.pkg"
    echo "🔏 Signing PKG with: $DEVELOPER_ID_INSTALLER"
    productsign --sign "$DEVELOPER_ID_INSTALLER" "$pkg_path" "$signed_pkg"
    mv "$signed_pkg" "$pkg_path"
    pkgutil --check-signature "$pkg_path"
    echo "✅ PKG signed"
}

notarize_if_configured() {
    local artifact_path="$1"

    if [ -z "$NOTARYTOOL_PROFILE" ]; then
        echo "⚠️  NOTARYTOOL_PROFILE not set; skipping notarization for $artifact_path"
        return
    fi

    echo "📮 Submitting for notarization: $artifact_path"
    xcrun notarytool submit "$artifact_path" --keychain-profile "$NOTARYTOOL_PROFILE" --wait
    xcrun stapler staple "$artifact_path"
    spctl -a -vv -t install "$artifact_path" || true
    echo "✅ Notarization stapled: $artifact_path"
}

expand_electrobun_bundle_if_needed() {
    local app_path="$1"
    local payload
    payload=$(find "$app_path/Contents/Resources" -maxdepth 1 -name "*.tar.zst" | head -1)

    if [ -z "$payload" ]; then
        echo "✅ App bundle is already expanded"
        return
    fi

    local zstd_bin="node_modules/electrobun/dist-macos-arm64/zig-zstd"
    if [ ! -x "$zstd_bin" ]; then
        echo "❌ Error: Electrobun decompressor not found at $zstd_bin"
        exit 1
    fi

    echo "📦 Expanding Electrobun self-extracting bundle..."
    local temp_dir
    temp_dir="$(mktemp -d)"
    local payload_tar="$temp_dir/bundle.tar"
    "$zstd_bin" decompress -i "$payload" -o "$payload_tar" --no-timing
    tar -xf "$payload_tar" -C "$temp_dir"

    local expanded_app
    expanded_app=$(find "$temp_dir" -maxdepth 1 -name "*.app" -type d | head -1)
    if [ -z "$expanded_app" ]; then
        echo "❌ Error: Expanded Electrobun payload did not contain an app bundle"
        rm -rf "$temp_dir"
        exit 1
    fi

    local replacement="${app_path}.expanded"
    rm -rf "$replacement"
    ditto --norsrc --noextattr "$expanded_app" "$replacement"
    rm -rf "$app_path"
    mv "$replacement" "$app_path"
    rm -rf "$temp_dir"

    /usr/libexec/PlistBuddy -c "Set :CFBundleName $APP_NAME" "$app_path/Contents/Info.plist" 2>/dev/null || true
    /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" "$app_path/Contents/Info.plist" 2>/dev/null || true
    /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $VERSION" "$app_path/Contents/Info.plist" 2>/dev/null || true

    echo "✅ Electrobun bundle expanded for distribution"
}

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

# Step 3: Expand Electrobun bundle
echo "Step 3: Preparing runnable app bundle..."
expand_electrobun_bundle_if_needed "$APP_BUNDLE"
echo ""

# Step 4: Copy icon to app bundle
echo "Step 4: Adding custom icon..."
if [ -f "CertificateReminder.icns" ]; then
    mkdir -p "$APP_BUNDLE/Contents/Resources"
    cp CertificateReminder.icns "$APP_BUNDLE/Contents/Resources/AppIcon.icns"
    touch "$APP_BUNDLE"
    echo "✅ Icon copied to app bundle"
else
    echo "⚠️  Warning: CertificateReminder.icns not found, using default icon"
fi
echo ""

# Step 5: Remove quarantine attributes from app bundle
echo "Step 5: Removing quarantine attributes..."
if [ -d "$APP_BUNDLE" ]; then
    xattr -cr "$APP_BUNDLE"
    echo "✅ Quarantine attributes removed from app bundle"
else
    echo "❌ Error: App bundle not found at $APP_BUNDLE"
    exit 1
fi
echo ""

# Step 6: Sign app if configured
echo "Step 6: Signing app if configured..."
sign_app_if_configured "$APP_BUNDLE"
echo ""

# Step 7: Copy to distribution folder
echo "Step 7: Preparing distribution..."
DIST_DIR="CertificateReminder-Distribution"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# Copy and rename app bundle
cp -R "$APP_BUNDLE" "$DIST_DIR/$APP_NAME.app"
touch "$DIST_DIR/$APP_NAME.app"
echo "✅ App bundle copied to distribution folder"
echo ""

# Step 8: Copy documentation and examples
echo "Step 8: Adding documentation..."
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

# Step 9: Create DMG
echo "Step 9: Creating DMG..."
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

# Step 10: Create PKG installer
echo "Step 10: Creating PKG installer..."
PKG_SCRIPTS_DIR="$(mktemp -d)"
PKG_APP_STAGE_DIR="$(mktemp -d)"
cp pkg-postinstall.sh "$PKG_SCRIPTS_DIR/postinstall"
chmod +x "$PKG_SCRIPTS_DIR/postinstall"
ditto --norsrc --noextattr "$DIST_DIR/$APP_NAME.app" "$PKG_APP_STAGE_DIR/$APP_NAME.app"
COPYFILE_DISABLE=1 tar -czf "$PKG_SCRIPTS_DIR/$APP_NAME.app.tar.gz" -C "$PKG_APP_STAGE_DIR" "$APP_NAME.app"
pkgbuild \
    --nopayload \
    --identifier "com.certificates.reminder" \
    --version "$VERSION" \
    --scripts "$PKG_SCRIPTS_DIR" \
    "$PKG_PATH"
rm -rf "$PKG_SCRIPTS_DIR"
rm -rf "$PKG_APP_STAGE_DIR"
xattr -cr "$PKG_PATH"
echo "✅ PKG created: $PKG_PATH"
echo ""

# Step 11: Sign and notarize release installers if configured
echo "Step 11: Signing and notarizing installers if configured..."
sign_pkg_if_configured "$PKG_PATH"
notarize_if_configured "$PKG_PATH"
notarize_if_configured "$DMG_PATH"
echo ""

# Step 12: Copy installer wrapper script to artifacts
echo "Step 12: Adding installer wrapper script..."
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
if [ -z "$DEVELOPER_ID_INSTALLER" ] || [ -z "$NOTARYTOOL_PROFILE" ]; then
    echo ""
    echo "⚠️  This build is NOT fully ready for non-technical internet distribution."
    echo "   Set DEVELOPER_ID_APPLICATION, DEVELOPER_ID_INSTALLER, and NOTARYTOOL_PROFILE"
    echo "   to produce a signed and notarized PKG that Gatekeeper can verify."
fi
