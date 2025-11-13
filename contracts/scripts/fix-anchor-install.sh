#!/bin/bash
# Fix Anchor 0.29.0 installation issue

set -e

echo "🔧 Fixing Anchor 0.29.0 installation..."

# Find where avm stores binaries
AVM_BIN_DIR="$HOME/.avm/bin"
AVM_VERSIONS_DIR="$HOME/.avm/versions"

echo "📁 AVM bin directory: $AVM_BIN_DIR"
echo "📁 AVM versions directory: $AVM_VERSIONS_DIR"

# Remove existing anchor binary if it exists
if [ -f "$AVM_BIN_DIR/anchor" ]; then
    echo "🗑️  Removing existing anchor binary..."
    rm -f "$AVM_BIN_DIR/anchor"
fi

# Remove 0.29.0 directory if it exists (partial install)
if [ -d "$AVM_VERSIONS_DIR/0.29.0" ]; then
    echo "🗑️  Removing partial 0.29.0 installation..."
    rm -rf "$AVM_VERSIONS_DIR/0.29.0"
fi

# Now install with force
echo "📥 Installing Anchor 0.29.0 with --force..."
avm install 0.29.0 --force

# Use it
echo "🔄 Switching to Anchor 0.29.0..."
avm use 0.29.0

# Verify
echo "✅ Verifying installation..."
anchor --version

echo ""
echo "✅ Done! Anchor 0.29.0 should now be active."

