#!/bin/bash

# Deploy Qantara V2 to devnet
set -e

echo "🚀 Deploying Qantara V2 to devnet..."

cd "$(dirname "$0")/.."

# Set environment
export ANCHOR_PROVIDER_URL=${ANCHOR_PROVIDER_URL:-"https://api.devnet.solana.com"}
export ANCHOR_WALLET=${ANCHOR_WALLET:-"$HOME/.config/solana/id.json"}

# Build first
echo "🔨 Building V2 contract..."
anchor build --program-name qantara-v2

# Copy binary to Anchor's expected location
SOURCE="programs/qantara-v2/target/deploy/qantara_v2.so"
DEST="target/deploy/qantara_v2.so"

if [ ! -f "$SOURCE" ]; then
    echo "❌ Binary not found at: $SOURCE"
    echo "   Build failed!"
    exit 1
fi

echo "📦 Copying binary to Anchor's expected location..."
mkdir -p target/deploy
cp "$SOURCE" "$DEST"
echo "✅ Binary ready at: $DEST"

# Check wallet balance
echo "💰 Checking wallet balance..."
BALANCE=$(solana balance --url devnet 2>/dev/null | grep -oP '\d+\.\d+' | head -1 || echo "0")
echo "   Current balance: $BALANCE SOL"

if (( $(echo "$BALANCE < 2.0" | bc -l) )); then
    echo "⚠️  Warning: Low balance. Deployment may require 2-5 SOL."
    echo "   Airdrop with: solana airdrop 2 --url devnet"
fi

# Deploy
echo "🚀 Deploying to devnet..."
anchor deploy --program-name qantara-v2 --provider.cluster devnet

echo "✅ Deployment complete!"

