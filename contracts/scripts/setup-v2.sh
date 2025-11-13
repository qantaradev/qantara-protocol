#!/bin/bash

# Setup script for Qantara V2 contract
set -e

echo "🔧 Setting up Qantara V2..."

# Navigate to contracts directory
cd "$(dirname "$0")/.."

# Generate program keypair if it doesn't exist
if [ ! -f "programs/qantara-v2/target/deploy/qantara-v2-keypair.json" ]; then
    echo "📝 Generating program keypair..."
    mkdir -p programs/qantara-v2/target/deploy
    solana-keygen new --outfile programs/qantara-v2/target/deploy/qantara-v2-keypair.json --force
fi

# Extract program ID
PROGRAM_ID=$(solana-keygen pubkey programs/qantara-v2/target/deploy/qantara-v2-keypair.json)
echo "✅ Program ID: $PROGRAM_ID"

# Update lib.rs with program ID
if [ -f "programs/qantara-v2/src/lib.rs" ]; then
    # Use sed to replace declare_id! line
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/declare_id!(\".*\");/declare_id!(\"$PROGRAM_ID\");/" programs/qantara-v2/src/lib.rs
    else
        # Linux
        sed -i "s/declare_id!(\".*\");/declare_id!(\"$PROGRAM_ID\");/" programs/qantara-v2/src/lib.rs
    fi
    echo "✅ Updated lib.rs with program ID"
fi

# Update Anchor.toml
if [ -f "Anchor.toml" ]; then
    # Check if qantara_v2 is already in Anchor.toml
    if ! grep -q "qantara_v2" Anchor.toml; then
        echo "⚠️  Please manually add qantara_v2 to Anchor.toml:"
        echo "   [programs.devnet]"
        echo "   qantara_v2 = \"$PROGRAM_ID\""
    else
        echo "✅ Anchor.toml already configured"
    fi
fi

echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Run: anchor build"
echo "2. Run: anchor test --skip-local-validator"

