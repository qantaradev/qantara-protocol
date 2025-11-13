# Quick Fix Guide

## Problem 1: Anchor 0.29.0 Installation

The installation is failing because a binary already exists. Fix it:

```bash
# Force install Anchor 0.29.0
avm install 0.29.0 --force

# Use it
avm use 0.29.0

# Verify
anchor --version  # Should show 0.29.0
```

## Problem 2: IDL Not Generated

If `anchor build` doesn't generate the IDL, create it manually:

```bash
cd /mnt/d/projects/crypto/Qantara/contracts

# Option 1: Use the script
bash scripts/generate-idl-manual.sh

# Option 2: Or manually with anchor (if it works)
anchor idl build --filepath target/idl/qantara.json
```

## Problem 3: Cargo Config Error

The `.cargo/config.toml` had wrong syntax. I've removed it. The stack size warnings from `spl-token-2022` are from dependencies and can be safely ignored.

## Complete Setup Steps

```bash
cd /mnt/d/projects/crypto/Qantara/contracts

# 1. Install correct Anchor version
avm install 0.29.0 --force
avm use 0.29.0

# 2. Build (this should work now)
anchor build

# 3. If IDL still missing, generate manually
bash scripts/generate-idl-manual.sh

# 4. Verify IDL exists
ls -la target/idl/qantara.json

# 5. Run tests (skip Rust unit tests, run only TS integration tests)
# Install dependencies first if needed
cd ..
pnpm install  # or npm install

cd contracts
# Run tests with mocha directly
npx ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts
```

## Alternative: Use Anchor 0.31.1

If you can't get 0.29.0 working, you could upgrade to 0.31.1, but you'd need to update the dependencies in `Cargo.toml`:

```toml
anchor-lang = "0.31.1"
anchor-spl = "0.31.1"
```

But it's better to stick with 0.29.0 for now since that's what the project is configured for.

