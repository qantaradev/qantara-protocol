#!/bin/bash

# Run Foundation Tests for Qantara V2 API

echo "🧪 Running Qantara V2 API Foundation Tests"
echo "==========================================="

# Check if IDL exists
IDL_PATH="../contracts/target/idl/qantara_v2.json"
if [ ! -f "$IDL_PATH" ]; then
    echo "⚠️  IDL not found at $IDL_PATH"
    echo "Building contract first..."
    cd ../contracts
    anchor build --program-name qantara-v2
    cd ../apps/api-server
fi

# Set environment variables
export RPC_URL="${RPC_URL:-https://api.devnet.solana.com}"
export NODE_ENV=test

# Run tests
npm run test:foundation

echo ""
echo "✅ Foundation tests complete!"

