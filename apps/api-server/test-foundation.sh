#!/bin/bash

# Qantara V2 API Foundation Test Script
# Tests basic functionality without Jupiter swaps

set -e

echo "🧪 Testing Qantara V2 API Foundation"
echo "===================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_URL="${API_URL:-http://localhost:3000}"

# Test 1: Health Check
echo -e "\n${YELLOW}Test 1: Health Check${NC}"
response=$(curl -s -w "\n%{http_code}" "$API_URL/health" || echo "000")
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✅ Health check passed${NC}"
    echo "Response: $body"
else
    echo -e "${RED}❌ Health check failed (HTTP $http_code)${NC}"
    echo "Response: $body"
    exit 1
fi

# Test 2: Check if server is running
echo -e "\n${YELLOW}Test 2: Server Status${NC}"
if curl -s -f "$API_URL/health" > /dev/null; then
    echo -e "${GREEN}✅ Server is running${NC}"
else
    echo -e "${RED}❌ Server is not running${NC}"
    echo "Make sure to start the server: npm run dev"
    exit 1
fi

echo -e "\n${GREEN}✅ Foundation tests passed!${NC}"
echo "Next: Test individual endpoints with actual data"

