#!/bin/bash

# Test V2 only using direct TypeScript execution (no deployment needed)
set -e

echo "🧪 Testing Qantara V2 (Direct TypeScript - No Deployment Required)..."

cd "$(dirname "$0")/.."

# Set environment variables
export ANCHOR_PROVIDER_URL=${ANCHOR_PROVIDER_URL:-"https://api.devnet.solana.com"}
export ANCHOR_WALLET=${ANCHOR_WALLET:-"$HOME/.config/solana/id.json"}

echo "🔧 Environment:"
echo "   ANCHOR_PROVIDER_URL: $ANCHOR_PROVIDER_URL"
echo "   ANCHOR_WALLET: $ANCHOR_WALLET"

# Build V2 first (generates IDL)
echo "🔨 Building V2 contract (generates IDL)..."
anchor build --program-name qantara-v2

# Verify IDL exists
if [ ! -f "target/idl/qantara_v2.json" ]; then
    echo "❌ IDL not found at target/idl/qantara_v2.json"
    echo "   Build failed or IDL not generated"
    exit 1
fi

echo "✅ IDL found: target/idl/qantara_v2.json"

# Run TypeScript tests directly (no deployment needed!)
echo "🧪 Running V2 TypeScript tests (using IDL, no deployment)..."
if [ -d "tests/v2" ]; then
    # Use ts-mocha to run V2 tests directly
    # This loads the IDL and tests against devnet without deploying
    npx ts-mocha -p ./tsconfig.json -t 1000000 tests/v2/**/*.ts
else
    echo "❌ tests/v2 directory not found"
    exit 1
fi

echo "✅ Tests complete!"

