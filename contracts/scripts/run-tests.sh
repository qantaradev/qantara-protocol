#!/bin/bash
# Run TypeScript integration tests with proper environment setup

set -e

cd "$(dirname "$0")/.."

echo "🧪 Running Qantara tests..."

# Check if IDL exists
if [ ! -f "target/idl/qantara.json" ]; then
    echo "❌ IDL not found. Run 'anchor build' first."
    exit 1
fi

echo "✅ IDL found at target/idl/qantara.json"

# Set up environment variables
export ANCHOR_PROVIDER_URL="${ANCHOR_PROVIDER_URL:-https://api.devnet.solana.com}"
export ANCHOR_WALLET="${ANCHOR_WALLET:-$HOME/.config/solana/id.json}"

# Resolve PROGRAM_ID from env, IDL, or Anchor.toml
if [ -z "$PROGRAM_ID" ]; then
  if [ -f "target/idl/qantara.json" ]; then
    PROGRAM_ID=$(sed -n 's/.*"address" *: *"\([^"]*\)".*/\1/p' target/idl/qantara.json | head -1)
  fi
  if [ -z "$PROGRAM_ID" ] && [ -f "Anchor.toml" ]; then
    PROGRAM_ID=$(sed -n '/\[programs\.devnet\]/,/\[/{/qantara/ s/.*= *"\([^"]*\)"/\1/p}' Anchor.toml | head -1)
    if [ -z "$PROGRAM_ID" ]; then
      PROGRAM_ID=$(sed -n '/\[programs\.mainnet\]/,/\[/{/qantara/ s/.*= *"\([^"]*\)"/\1/p}' Anchor.toml | head -1)
    fi
  fi
  export PROGRAM_ID
fi

echo "🔧 Environment:"
echo "   ANCHOR_PROVIDER_URL: $ANCHOR_PROVIDER_URL"
echo "   ANCHOR_WALLET: $ANCHOR_WALLET"
if [ -n "$PROGRAM_ID" ]; then
  echo "   PROGRAM_ID: $PROGRAM_ID"
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    if command -v pnpm &> /dev/null; then
        pnpm install
    elif command -v npm &> /dev/null; then
        npm install
    elif command -v yarn &> /dev/null; then
        yarn install
    else
        echo "❌ No package manager found. Please install pnpm, npm, or yarn."
        exit 1
    fi
fi

# Run tests
echo "🚀 Running tests..."
if command -v pnpm &> /dev/null; then
    pnpm exec ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts
elif command -v npx &> /dev/null; then
    npx ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts
elif command -v yarn &> /dev/null; then
    yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts
else
    echo "❌ No package manager found to run tests."
    exit 1
fi
