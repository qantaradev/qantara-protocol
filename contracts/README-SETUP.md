# Setup Instructions

## Fix "String is the wrong size" Error

This error occurs when Anchor can't find or validate the program keypair. Follow these steps:

### Option 1: Let Anchor Generate Keypair (Recommended)

```bash
# In WSL
cd contracts

# Create deploy directory if it doesn't exist
mkdir -p target/deploy

# Generate a new program keypair
solana-keygen new --outfile target/deploy/qantara-keypair.json --no-bip39-passphrase --force

# Get the program ID
PROGRAM_ID=$(solana-keygen pubkey target/deploy/qantara-keypair.json)
echo "Program ID: $PROGRAM_ID"

# Update lib.rs with the new program ID
sed -i "s/declare_id!(\".*\")/declare_id!(\"$PROGRAM_ID\")/" programs/qantara/src/lib.rs

# Update Anchor.toml
sed -i "s/qantara = \".*\"/qantara = \"$PROGRAM_ID\"/" Anchor.toml

# Now build
anchor build
```

### Option 2: Use Anchor Keys Sync

```bash
cd contracts
anchor keys sync
anchor build
```

### Option 3: Manual Setup

1. Generate keypair:
```bash
solana-keygen new --outfile target/deploy/qantara-keypair.json --no-bip39-passphrase
```

2. Copy the public key and update:
   - `programs/qantara/src/lib.rs` - `declare_id!()` line
   - `Anchor.toml` - `[programs.devnet]` section

3. Build:
```bash
anchor build
```

## Verify Setup

After setup, verify the program ID matches:

```bash
# Check keypair
solana-keygen pubkey target/deploy/qantara-keypair.json

# Check lib.rs
grep "declare_id!" programs/qantara/src/lib.rs

# Check Anchor.toml
grep "qantara = " Anchor.toml
```

All three should show the same program ID.

