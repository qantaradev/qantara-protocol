#!/bin/bash

# Copy V2 binary to Anchor's expected location
set -e

cd "$(dirname "$0")/.."

# Source location (where Anchor builds it)
SOURCE="programs/qantara-v2/target/deploy/qantara_v2.so"

# Destination (where Anchor expects it for deployment)
DEST="target/deploy/qantara_v2.so"

# Create destination directory if it doesn't exist
mkdir -p target/deploy

# Check if source exists
if [ ! -f "$SOURCE" ]; then
    echo "❌ Source binary not found: $SOURCE"
    echo "   Run 'anchor build --program-name qantara-v2' first"
    exit 1
fi

# Copy the binary
echo "📦 Copying binary to Anchor's expected location..."
cp "$SOURCE" "$DEST"

echo "✅ Binary copied: $DEST"
echo ""
echo "Now you can deploy with:"
echo "  anchor deploy --program-name qantara-v2 --provider.cluster devnet"

