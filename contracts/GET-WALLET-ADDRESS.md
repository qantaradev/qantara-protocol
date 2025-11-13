# Get Your Wallet Address

## Quick Command

Run this in WSL (where Solana CLI is installed):

```bash
solana address --url devnet
```

This will show your wallet address that you can fund.

## Fund Your Wallet on Devnet

### Option 1: Solana Official Faucet (Easiest)
1. Go to: **https://faucet.solana.com/**
2. Paste your wallet address
3. Click "Airdrop 2 SOL"
4. Wait a few seconds

### Option 2: SolFaucet
1. Go to: **https://solfaucet.com/**
2. Select "Devnet"
3. Paste your wallet address
4. Complete captcha
5. Click "Request Airdrop"

### Option 3: Command Line (if network works)
```bash
solana airdrop 2 $(solana address) --url devnet
```

## Verify You Have SOL

After funding, check your balance:
```bash
solana balance --url devnet
```

You should see something like:
```
2 SOL
```

## Then Run Tests

Once your wallet is funded, run:
```bash
npm run test:v2
```

The test will:
1. Show your wallet address (for reference)
2. Try to airdrop to test accounts
3. If airdrops fail, you can manually fund those addresses too (they'll be shown in the output)

## Note

The test generates new keypairs for each test run, but it uses your main wallet to:
- Sign transactions
- Pay transaction fees
- Fund initial operations

So funding your main wallet should be enough for most tests!

