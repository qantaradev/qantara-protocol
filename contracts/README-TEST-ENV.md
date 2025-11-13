# Test Environment Setup

## Quick Start

Run tests with the provided script (handles environment automatically):

```bash
cd /mnt/d/projects/crypto/Qantara/contracts
npm test
# or
bash scripts/run-tests.sh
```

## Manual Setup

If you want to run tests manually, set these environment variables:

```bash
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
export ANCHOR_WALLET=~/.config/solana/id.json

# Then run tests
npx ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts
```

## Troubleshooting

### "ANCHOR_PROVIDER_URL is not defined"

The test script now sets this automatically. If you see this error:
1. Make sure you're using `npm test` or `bash scripts/run-tests.sh`
2. Or manually export the variables before running tests

### "Program file not found" during anchor test

This is expected if you haven't deployed. The TypeScript tests don't require deployment - they use the IDL to interact with the program.

### Missing Solana Wallet

If you don't have a Solana wallet:
```bash
solana-keygen new --outfile ~/.config/solana/id.json
```

Then airdrop some SOL for testing:
```bash
solana airdrop 2 $(solana address) --url devnet
```

