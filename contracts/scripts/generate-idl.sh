#!/bin/bash
# Generate IDL after build

cd "$(dirname "$0")/.."

echo "📝 Generating IDL..."

# Ensure target/idl directory exists
mkdir -p target/idl

# Copy IDL from build output if it exists
if [ -f "target/idl/qantara.json" ]; then
    echo "✅ IDL already exists at target/idl/qantara.json"
    exit 0
fi

# Try to generate IDL using anchor
if command -v anchor &> /dev/null; then
    anchor idl build --filepath target/idl/qantara.json 2>/dev/null || {
        echo "⚠️  Could not generate IDL automatically"
        echo "📋 Please ensure anchor build completed successfully"
        echo "   The IDL should be at: target/idl/qantara.json"
    }
else
    echo "⚠️  Anchor CLI not found"
fi

