#!/bin/bash
# Quick fix for program ID issues

set -e

cd "$(dirname "$0")/.."

echo "🔧 Fixing Qantara program ID..."

# Ensure deploy directory exists
mkdir -p target/deploy

# Generate or use existing keypair
if [ ! -f "target/deploy/qantara-keypair.json" ]; then
    echo "📝 Generating new program keypair..."
    solana-keygen new --outfile target/deploy/qantara-keypair.json --no-bip39-passphrase --force
else
    echo "✅ Using existing keypair"
fi

# Get program ID
PROGRAM_ID=$(solana-keygen pubkey target/deploy/qantara-keypair.json)
echo "🔑 Program ID: $PROGRAM_ID"

# Update lib.rs
if [ -f "programs/qantara/src/lib.rs" ]; then
    # Use a more robust sed command that works on both GNU and BSD sed
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|declare_id!(\"[^\"]*\");|declare_id!(\"$PROGRAM_ID\");|" programs/qantara/src/lib.rs
    else
        sed -i "s|declare_id!(\"[^\"]*\");|declare_id!(\"$PROGRAM_ID\");|" programs/qantara/src/lib.rs
    fi
    echo "✅ Updated programs/qantara/src/lib.rs"
fi

# Update Anchor.toml
if [ -f "Anchor.toml" ]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|qantara = \"[^\"]*\"|qantara = \"$PROGRAM_ID\"|" Anchor.toml
    else
        sed -i "s|qantara = \"[^\"]*\"|qantara = \"$PROGRAM_ID\"|" Anchor.toml
    fi
    echo "✅ Updated Anchor.toml"
fi

echo ""
echo "✅ Setup complete!"
echo "📋 Program ID: $PROGRAM_ID"
echo ""
echo "Now run: anchor build"

