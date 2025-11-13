#!/bin/bash

# Build contract and run foundation tests

set -e

echo "🔨 Building Qantara V2 contract..."
cd ../../contracts
anchor build --program-name qantara-v2

echo ""
echo "🧪 Running foundation tests..."
cd ../apps/api-server
npm run test:foundation

