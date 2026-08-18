#!/bin/bash
# Certificate Reminder - Development Build & Run Script

set -e

echo "🔨 Building Certificate Reminder..."

# Build Next.js static export
echo "  → Building Next.js..."
bun run build > /dev/null 2>&1

# Build Electrobun app
echo "  → Bundling with Electrobun..."
bun run electrobun:build > /dev/null 2>&1

# Launch the app
echo "  → Launching app..."
open "build/dev-macos-arm64/Certificate Reminder-dev.app"

echo "✅ App is running!"
