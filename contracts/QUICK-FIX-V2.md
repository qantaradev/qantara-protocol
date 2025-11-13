# Quick Fix: V2 Build & Test

## Problem
Anchor is trying to deploy both V1 and V2, but V1 isn't built, causing deployment errors.

## Solution: Test V2 Only

### Option 1: Build V2 Only (Recommended)

In WSL terminal:

```bash
cd /mnt/d/projects/crypto/Qantara/contracts

# Build only V2
anchor build --program-name qantara-v2

# Test V2 (skip deployment)
anchor test --skip-local-validator --skip-deploy
```

### Option 2: Build Both Programs

If you want both V1 and V2:

```bash
cd /mnt/d/projects/crypto/Qantara/contracts

# Build both
anchor build

# This will build both qantara.so and qantara-v2.so
```

### Option 3: Use Test Script

```bash
cd /mnt/d/projects/crypto/Qantara/contracts
bash scripts/test-v2-only.sh
```

## What's Happening

- ✅ V2 compiles successfully
- ❌ Anchor tries to deploy V1 (qantara) which isn't built
- ✅ Solution: Skip deployment or build V1 too

## Next Steps

1. **Build V2 only**: `anchor build --program-name qantara-v2`
2. **Run tests**: `anchor test --skip-local-validator --skip-deploy`
3. **Or use script**: `bash scripts/test-v2-only.sh`

The V2 contract is ready - we just need to test it without deploying V1!

