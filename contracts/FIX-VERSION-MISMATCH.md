# Fix: Version Mismatch Between Anchor CLI and anchor-js

## Problem

- **Anchor CLI**: 0.31.1 (generates IDL)
- **anchor-js**: 0.29.0 (tries to parse IDL)
- **Error**: "Cannot use 'in' operator to search for 'vec' in pubkey"

The IDL format from Anchor 0.31.1 is incompatible with anchor-js 0.29.0.

## Solution

Upgrade `@coral-xyz/anchor` to match Anchor CLI version:

```bash
cd /mnt/d/projects/crypto/Qantara/contracts
pnpm install @coral-xyz/anchor@^0.31.1
```

Or if using npm:

```bash
npm install --save-dev @coral-xyz/anchor@^0.31.1
```

## Why This Happens

Anchor 0.31.1 generates IDLs with a different structure than 0.29.0. The `pubkey` type definition changed, causing anchor-js 0.29.0 to fail parsing.

## After Upgrade

1. Reinstall dependencies
2. Run tests again: `npm run test:v2`

The versions should match:
- Anchor CLI: 0.31.1
- anchor-js: 0.31.1

