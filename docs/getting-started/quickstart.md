# Quick Start Guide

Get up and running with Qantara Protocol in minutes. This guide will walk you through creating your first merchant and processing a payment.

## Overview

Qantara Protocol enables merchants to accept crypto payments with automatic token buyback and burn. This quick start covers:

1. Setting up a merchant account
2. Creating a payment quote
3. Processing a payment transaction

## Prerequisites

- Completed [Installation Guide](./installation.md)
- A Solana wallet with some devnet SOL (for testing)
- Basic understanding of Solana transactions

## Step 1: Register a Merchant

First, register your merchant account with the protocol.

### API Request

```bash
curl -X POST http://localhost:3001/v2/merchants/register \
  -H "Content-Type: application/json" \
  -d '{
    "merchantOwner": "YOUR_WALLET_PUBLIC_KEY",
    "payoutWallet": "YOUR_PAYOUT_WALLET_PUBLIC_KEY",
    "buybackMint": "YOUR_COMMUNITY_TOKEN_MINT",
    "defaultPayoutBps": 7000,
    "defaultBuybackBps": 3000,
    "defaultBurnBps": 5000,
    "slippageBps": 100,
    "allowSol": true,
    "allowUsdc": true
  }'
```

### Response

```json
{
  "merchantId": "12345678901234567890",
  "merchantRegistryPDA": "ABC...XYZ",
  "vaultBuybackToken": "DEF...UVW",
  "status": "registered"
}
```

**Important:** Save the `merchantId` - you'll need it for all subsequent operations.

### Parameters Explained

- `merchantOwner`: Your wallet public key (signer for on-chain registration)
- `payoutWallet`: Where payment proceeds will be sent
- `buybackMint`: Your community token mint address
- `defaultPayoutBps`: Percentage of payment to merchant (7000 = 70%)
- `defaultBuybackBps`: Percentage for token buyback (3000 = 30%)
- `defaultBurnBps`: Percentage of buyback tokens to burn (5000 = 50%)
- `slippageBps`: Maximum slippage tolerance (100 = 1%)

### Complete On-Chain Registration

After API registration, you need to complete the on-chain registration:

```typescript
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { getProgram } from '@qantara/api-server/services/program';

const connection = new Connection('https://api.devnet.solana.com');
const merchantOwner = Keypair.fromSecretKey(/* your keypair */);
const merchantId = "12345678901234567890"; // From registration response
const payoutWallet = new PublicKey("YOUR_PAYOUT_WALLET");
const buybackMint = new PublicKey("YOUR_BUYBACK_MINT");

const program = getProgram(connection);
const [merchantRegistryPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("merchant"), Buffer.from(merchantId)],
  program.programId
);

await program.methods
  .registerMerchant(
    new BN(merchantId),
    payoutWallet,
    buybackMint
  )
  .accounts({
    merchantRegistry: merchantRegistryPDA,
    owner: merchantOwner.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .signers([merchantOwner])
  .rpc();
```

## Step 2: Get a Payment Quote

Before processing a payment, get a quote to see the breakdown.

### API Request

```bash
curl -X POST http://localhost:3001/v2/quote \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "12345678901234567890",
    "price": 100,
    "payToken": "USDC",
    "payoutBps": 7000,
    "buybackBps": 3000,
    "burnBps": 5000
  }'
```

### Response

```json
{
  "quoteId": "550e8400-e29b-41d4-a716-446655440000",
  "merchantId": "12345678901234567890",
  "amount": "100000000",
  "payToken": "USDC",
  "payoutBps": 7000,
  "buybackBps": 3000,
  "burnBps": 5000,
  "buybackAmount": "30000000",
  "minOut": "1500000000",
  "estimatedTokens": "1515151515",
  "slippageBps": 100,
  "quote": { /* Jupiter quote data */ },
  "swapTransaction": "base64_encoded_transaction",
  "expiresAt": 1234567890
}
```

### Understanding the Quote

- `amount`: Total payment amount in token's smallest unit (100 USDC = 100000000)
- `buybackAmount`: Amount allocated for buyback (30% of payment)
- `estimatedTokens`: Expected tokens received from buyback
- `minOut`: Minimum tokens guaranteed (with slippage protection)
- `expiresAt`: Quote expiration timestamp (30 seconds)

## Step 3: Build Payment Transaction

Build the transaction that the buyer will sign.

### API Request

```bash
curl -X POST http://localhost:3001/v2/build-tx \
  -H "Content-Type: application/json" \
  -d '{
    "quoteId": "550e8400-e29b-41d4-a716-446655440000",
    "merchantId": "12345678901234567890",
    "payer": "BUYER_WALLET_PUBLIC_KEY",
    "amount": "100000000",
    "payToken": "USDC",
    "minOut": "1500000000",
    "payoutBps": 7000,
    "buybackBps": 3000,
    "burnBps": 5000,
    "swapTransaction": "base64_encoded_from_quote",
    "priorityFee": 0.0001
  }'
```

### Response

```json
{
  "transaction": "base64_encoded_transaction",
  "expiresAt": 1234567890
}
```

## Step 4: Sign and Send Transaction

The buyer signs and sends the transaction using their wallet.

### Using Solana Web3.js

```typescript
import { VersionedTransaction } from '@solana/web3.js';
import { Connection } from '@solana/web3.js';

const connection = new Connection('https://api.devnet.solana.com');
const transactionBuffer = Buffer.from(response.transaction, 'base64');
const transaction = VersionedTransaction.deserialize(transactionBuffer);

// Sign with buyer's wallet
transaction.sign([buyerKeypair]);

// Send transaction
const signature = await connection.sendTransaction(transaction);
await connection.confirmTransaction(signature);
```

### Using Wallet Adapter (Frontend)

```typescript
import { useWallet } from '@solana/wallet-adapter-react';
import { VersionedTransaction } from '@solana/web3.js';

const { publicKey, signTransaction } = useWallet();

const transactionBuffer = Buffer.from(response.transaction, 'base64');
const transaction = VersionedTransaction.deserialize(transactionBuffer);

// Sign with wallet
const signed = await signTransaction(transaction);

// Send
const signature = await connection.sendTransaction(signed);
```

## Step 5: Verify Payment

Check the transaction on Solana Explorer:

```
https://explorer.solana.com/tx/{signature}?cluster=devnet
```

Or query the on-chain event:

```typescript
const program = getProgram(connection);
const events = await program.account.merchantRegistry.all();

// Find your payment event
const paymentEvent = events.find(e => 
  e.account.merchantId.toString() === merchantId
);
```

## Complete Example

Here's a complete example using the API:

```typescript
import axios from 'axios';

const API_BASE = 'http://localhost:3001/v2';

// 1. Register merchant
const merchant = await axios.post(`${API_BASE}/merchants/register`, {
  merchantOwner: 'YOUR_WALLET',
  payoutWallet: 'YOUR_PAYOUT_WALLET',
  buybackMint: 'YOUR_TOKEN_MINT',
  defaultPayoutBps: 7000,
  defaultBuybackBps: 3000,
});

const merchantId = merchant.data.merchantId;

// 2. Get quote
const quote = await axios.post(`${API_BASE}/quote`, {
  merchantId,
  price: 100,
  payToken: 'USDC',
});

// 3. Build transaction
const tx = await axios.post(`${API_BASE}/build-tx`, {
  quoteId: quote.data.quoteId,
  merchantId,
  payer: 'BUYER_WALLET',
  amount: quote.data.amount,
  payToken: quote.data.payToken,
  minOut: quote.data.minOut,
  payoutBps: quote.data.payoutBps,
  buybackBps: quote.data.buybackBps,
  burnBps: quote.data.burnBps,
  swapTransaction: quote.data.swapTransaction,
});

// 4. Sign and send
const transaction = VersionedTransaction.deserialize(
  Buffer.from(tx.data.transaction, 'base64')
);
transaction.sign([buyerKeypair]);
const signature = await connection.sendTransaction(transaction);
```

## Next Steps

- [API Integration Guide](../api/overview.md) - Detailed API documentation
- [Architecture Overview](../architecture/overview.md) - Understand how it works
- [Security Guide](../security/overview.md) - Security best practices
- [Integration Examples](../integration/examples.md) - Real-world examples

## Troubleshooting

### Merchant Not Found

- Ensure you've completed on-chain registration
- Check merchant ID is correct
- Verify merchant is not frozen

### Quote Expired

- Quotes expire after 30 seconds
- Request a new quote before building transaction

### Transaction Fails

- Check buyer has sufficient balance
- Verify slippage tolerance is appropriate
- Ensure all accounts are valid
- Check protocol is not paused

### Swap Fails

- Verify buyback mint is valid
- Check Jupiter has liquidity for the route
- Ensure slippage tolerance is reasonable

