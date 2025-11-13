#!/bin/bash

# Build script for Qantara V2
set -e

echo "🔨 Building Qantara V2..."

cd "$(dirname "$0")/.."

# Check if program keypair exists
if [ ! -f "programs/qantara-v2/target/deploy/qantara-v2-keypair.json" ]; then
    echo "❌ Program keypair not found!"
    echo "Run: solana-keygen new --outfile programs/qantara-v2/target/deploy/qantara-v2-keypair.json"
    exit 1
fi

# Extract program ID
PROGRAM_ID=$(solana-keygen pubkey programs/qantara-v2/target/deploy/qantara-v2-keypair.json)
echo "📝 Program ID: $PROGRAM_ID"

# Update lib.rs if needed
CURRENT_ID=$(grep -oP 'declare_id!\("\K[^"]+' programs/qantara-v2/src/lib.rs | head -1)
if [ "$CURRENT_ID" != "$PROGRAM_ID" ]; then
    echo "🔄 Updating program ID in lib.rs..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/declare_id!(\".*\");/declare_id!(\"$PROGRAM_ID\");/" programs/qantara-v2/src/lib.rs
    else
        sed -i "s/declare_id!(\".*\");/declare_id!(\"$PROGRAM_ID\");/" programs/qantara-v2/src/lib.rs
    fi
fi

# Build
echo "🔨 Building contract..."
anchor build --program-name qantara-v2

# Copy binary to Anchor's expected location for deployment
SOURCE="programs/qantara-v2/target/deploy/qantara_v2.so"
DEST="target/deploy/qantara_v2.so"

if [ -f "$SOURCE" ]; then
    echo "📦 Copying binary to Anchor's expected location..."
    mkdir -p target/deploy
    cp "$SOURCE" "$DEST"
    echo "✅ Binary copied to: $DEST"
else
    echo "⚠️  Warning: Binary not found at $SOURCE"
fi

echo "✅ Build complete!"
echo ""
echo "Next: anchor test --skip-local-validator"

