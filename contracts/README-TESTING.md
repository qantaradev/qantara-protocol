# Testing Guide

## Prerequisites

1. **Anchor Version**: Make sure you have Anchor 0.29.0 installed
   ```bash
   avm install 0.29.0
   avm use 0.29.0
   ```

2. **Solana CLI**: Ensure Solana CLI is configured
   ```bash
   solana config set --url devnet
   ```

## Building

```bash
cd contracts
anchor build
```

This will:
- Compile the program
- Generate the IDL at `target/idl/qantara.json`

## Running Tests

```bash
anchor test
```

Or run tests directly with mocha:

```bash
yarn test
# or
pnpm test
```

## Troubleshooting

### "IDL doesn't exist" Error

If you see this error:
1. Make sure `anchor build` completed successfully
2. Check that `target/idl/qantara.json` exists
3. If not, try:
   ```bash
   anchor idl build --filepath target/idl/qantara.json
   ```

### Anchor Version Mismatch

If you see version mismatch warnings:
```bash
avm install 0.29.0
avm use 0.29.0
anchor --version  # Should show 0.29.0
```

### Stack Overflow Warnings

The `spl-token-2022` stack warnings are from dependencies and can be safely ignored. They don't affect compilation or functionality.

