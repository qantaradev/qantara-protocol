#!/bin/bash
# Install Anchor 0.29.0 with force

set -e

echo "🔧 Installing Anchor 0.29.0..."

# Force install Anchor 0.29.0
avm install 0.29.0 --force

# Use it
avm use 0.29.0

# Verify
echo "✅ Anchor version:"
anchor --version

