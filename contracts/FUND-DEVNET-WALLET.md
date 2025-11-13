# How to Fund Your Devnet Wallet

## Your Wallet Address

To get your wallet address, run:
```bash
solana address
# or
solana address --keypair ~/.config/solana/id.json
```

## Get Devnet SOL

### Option 1: Solana Faucet (Recommended)
1. Go to: https://faucet.solana.com/
2. Paste your wallet address
3. Click "Airdrop 2 SOL"
4. Wait a few seconds for confirmation

### Option 2: SolFaucet
1. Go to: https://solfaucet.com/
2. Select "Devnet"
3. Paste your wallet address
4. Complete the captcha
5. Click "Request Airdrop"

### Option 3: Command Line (if network works)
```bash
solana airdrop 2 <YOUR_WALLET_ADDRESS> --url devnet
```

## Verify Balance

After funding, check your balance:
```bash
solana balance --url devnet
```

## Test Accounts

The test will generate new keypairs for each test run, but it uses your wallet (`ANCHOR_WALLET`) to:
- Sign transactions
- Pay for transaction fees
- Fund initial operations

So you only need to fund your main wallet - the test will handle the rest!

## Alternative: Use a Pre-funded Wallet

If you want to use a specific wallet that's already funded, set:
```bash
export ANCHOR_WALLET=/path/to/your/funded/wallet.json
```

Then run the tests:
```bash
npm run test:v2
```

