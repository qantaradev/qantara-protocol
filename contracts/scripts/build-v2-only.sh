#!/bin/bash

# Build only V2 contract (skip V1)
set -e

echo "🔨 Building Qantara V2 only..."

cd "$(dirname "$0")/.."

# Build only V2
echo "📦 Building qantara-v2 program..."
cargo build-sbf --manifest-path programs/qantara-v2/Cargo.toml

echo "✅ V2 build complete!"
echo ""
echo "Binary location: target/deploy/qantara-v2.so"
echo ""
echo "To test: anchor test --skip-local-validator --skip-deploy"

