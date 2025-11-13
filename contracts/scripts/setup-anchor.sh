#!/bin/bash
# Setup correct Anchor version

set -e

echo "🔧 Setting up Anchor 0.29.0..."

# Check if avm is installed
if ! command -v avm &> /dev/null; then
    echo "❌ AVM (Anchor Version Manager) is not installed"
    echo "📦 Install it with: cargo install --git https://github.com/coral-xyz/anchor avm --locked --force"
    exit 1
fi

# Install and use Anchor 0.29.0
echo "📥 Installing Anchor 0.29.0..."
avm install 0.29.0 --force || true

echo "🔄 Switching to Anchor 0.29.0..."
avm use 0.29.0

# Verify
ANCHOR_VERSION=$(anchor --version 2>/dev/null | grep -oP '\d+\.\d+\.\d+' || echo "")
if [[ "$ANCHOR_VERSION" == "0.29.0" ]]; then
    echo "✅ Anchor 0.29.0 is now active"
    anchor --version
else
    echo "⚠️  Warning: Anchor version might not be correct"
    echo "   Expected: 0.29.0, Got: $ANCHOR_VERSION"
fi

