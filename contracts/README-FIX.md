# Quick Fix for Testing Issues

## Problem: "IDL doesn't exist" Error

This happens when the IDL file isn't generated after build. Here's how to fix it:

### Step 1: Use Correct Anchor Version

```bash
# In WSL
cd /mnt/d/projects/crypto/Qantara/contracts

# Install and use Anchor 0.29.0
avm install 0.29.0
avm use 0.29.0

# Verify
anchor --version  # Should show 0.29.0
```

### Step 2: Build and Generate IDL

```bash
# Clean and rebuild
anchor clean
anchor build

# Verify IDL exists
ls -la target/idl/qantara.json

# If IDL doesn't exist, generate it manually
anchor idl build --filepath target/idl/qantara.json
```

### Step 3: Run Tests

```bash
# Run integration tests (TypeScript)
anchor test

# Or run directly with mocha
yarn test
```

## Alternative: Skip Unit Tests

If you just want to run integration tests and skip the unit test that's failing:

```bash
# Run only TypeScript tests
yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts
```

## Note on Warnings

- The `spl-token-2022` stack warnings are from dependencies and can be ignored
- The `custom-heap`, `custom-panic`, `anchor-debug` warnings are from Anchor macros and are safe to ignore

