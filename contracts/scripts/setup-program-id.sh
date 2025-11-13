#!/bin/bash
# Setup program ID for Anchor

cd "$(dirname "$0")/.."

echo "🔑 Setting up Qantara program ID..."

# Generate keypair if it doesn't exist
if [ ! -f "target/deploy/qantara-keypair.json" ]; then
    echo "Generating new program keypair..."
    solana-keygen new --outfile target/deploy/qantara-keypair.json --no-bip39-passphrase
fi

# Get the program ID from the keypair
PROGRAM_ID=$(solana-keygen pubkey target/deploy/qantara-keypair.json)

echo "Program ID: $PROGRAM_ID"

# Update Anchor.toml with the program ID
if [ -f "Anchor.toml" ]; then
    # Update devnet program ID
    sed -i "s/qantara = \".*\"/qantara = \"$PROGRAM_ID\"/" Anchor.toml
    echo "✅ Updated Anchor.toml"
fi

# Update lib.rs with the program ID
if [ -f "programs/qantara/src/lib.rs" ]; then
    sed -i "s/declare_id!(\".*\")/declare_id!(\"$PROGRAM_ID\")/" programs/qantara/src/lib.rs
    echo "✅ Updated lib.rs"
fi

echo "✅ Setup complete! Program ID: $PROGRAM_ID"
echo "Now run: anchor build"

