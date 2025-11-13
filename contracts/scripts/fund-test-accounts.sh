#!/bin/bash

# Fund test accounts from main wallet
# Usage: bash scripts/fund-test-accounts.sh

set -e

# Source wallet keypair file path (not address!)
SOURCE_WALLET_KEYPAIR="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"
SOURCE_WALLET_ADDRESS="2KvYGjW7SXJQDwBxnTWDdLqQyGXQfrvxZkHKwHBkoYNV"

# Test accounts that need funding
PROTOCOL_AUTHORITY="4S44fQVnGVy7gaa4RGJN48mGxe9RMphQtnUiT5zWPRCf"
MERCHANT_OWNER="H45pfHRnXu9td4Y35gLEsEL1AahDyeWpNBcFnSKjDH7s"
BUYER="9GVwo3GfCSrda5mX3SgWbqY2GSHWvL2LvnmiB2R96dx2"

# Amounts to transfer (in SOL)
AMOUNT_PROTOCOL_AUTHORITY=0.1
AMOUNT_MERCHANT_OWNER=0.1
AMOUNT_BUYER=0.5

echo "💰 Funding test accounts from wallet: $SOURCE_WALLET"
echo ""

# Check if solana CLI is available
if ! command -v solana &> /dev/null; then
    echo "❌ solana CLI not found. Please install it first."
    exit 1
fi

# Set to devnet
solana config set --url devnet

# Check source wallet balance
echo "📊 Checking source wallet balance..."
echo "   Wallet keypair: $SOURCE_WALLET_KEYPAIR"
SOURCE_ADDRESS=$(solana address --keypair "$SOURCE_WALLET_KEYPAIR" --url devnet)
echo "   Wallet address: $SOURCE_ADDRESS"
BALANCE=$(solana balance "$SOURCE_ADDRESS" --url devnet | grep -oP '\d+\.\d+' | head -1)
echo "   Balance: $BALANCE SOL"
echo ""

# Calculate total needed
TOTAL_NEEDED=$(echo "$AMOUNT_PROTOCOL_AUTHORITY + $AMOUNT_MERCHANT_OWNER + $AMOUNT_BUYER" | bc)
echo "💸 Total needed: $TOTAL_NEEDED SOL"
echo ""

# Transfer to protocolAuthority
echo "📤 Transferring $AMOUNT_PROTOCOL_AUTHORITY SOL to protocolAuthority..."
solana transfer $PROTOCOL_AUTHORITY $AMOUNT_PROTOCOL_AUTHORITY --from "$SOURCE_WALLET_KEYPAIR" --url devnet --allow-unfunded-recipient
echo "   ✅ Done"
echo ""

# Transfer to merchantOwner
echo "📤 Transferring $AMOUNT_MERCHANT_OWNER SOL to merchantOwner..."
solana transfer $MERCHANT_OWNER $AMOUNT_MERCHANT_OWNER --from "$SOURCE_WALLET_KEYPAIR" --url devnet --allow-unfunded-recipient
echo "   ✅ Done"
echo ""

# Transfer to buyer
echo "📤 Transferring $AMOUNT_BUYER SOL to buyer..."
solana transfer $BUYER $AMOUNT_BUYER --from "$SOURCE_WALLET_KEYPAIR" --url devnet --allow-unfunded-recipient
echo "   ✅ Done"
echo ""

echo "✅ All test accounts funded!"
echo ""
echo "📋 Final balances:"
solana balance $PROTOCOL_AUTHORITY --url devnet
solana balance $MERCHANT_OWNER --url devnet
solana balance $BUYER --url devnet

