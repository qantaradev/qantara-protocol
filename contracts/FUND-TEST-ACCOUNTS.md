# Fund Test Accounts

## Quick Command

```bash
npm run fund:test-accounts
```

This will transfer SOL from your wallet to the test accounts:
- `protocolAuthority`: 0.1 SOL
- `merchantOwner`: 0.1 SOL
- `buyer`: 0.5 SOL

**Total: ~0.7 SOL**

## Manual Funding (Alternative)

If you prefer to fund manually using Solana CLI:

```bash
# Set to devnet
solana config set --url devnet

# Set wallet keypair path (use your actual wallet file path)
WALLET_KEYPAIR="$HOME/.config/solana/id.json"

# Fund each account (use --from with keypair file path, not address!)
solana transfer 4S44fQVnGVy7gaa4RGJN48mGxe9RMphQtnUiT5zWPRCf 0.1 --from "$WALLET_KEYPAIR" --url devnet
solana transfer H45pfHRnXu9td4Y35gLEsEL1AahDyeWpNBcFnSKjDH7s 0.1 --from "$WALLET_KEYPAIR" --url devnet
solana transfer 9GVwo3GfCSrda5mX3SgWbqY2GSHWvL2LvnmiB2R96dx2 0.5 --from "$WALLET_KEYPAIR" --url devnet
```

**Important:** Use `--from` with the **keypair file path**, not the public key address!

## Verify Balances

After funding, check balances:

```bash
solana balance 4S44fQVnGVy7gaa4RGJN48mGxe9RMphQtnUiT5zWPRCf --url devnet
solana balance H45pfHRnXu9td4Y35gLEsEL1AahDyeWpNBcFnSKjDH7s --url devnet
solana balance 9GVwo3GfCSrda5mX3SgWbqY2GSHWvL2LvnmiB2R96dx2 --url devnet
```

## Then Run Tests

Once accounts are funded, run:

```bash
npm run test:v2
```

The test will check balances and proceed without trying to fund.

