# Payment API

Endpoints for payment quote generation and transaction building.

## Get Payment Quote

Get a payment quote with buyback and burn calculations.

### Endpoint

```
POST /v2/quote
```

### Request Body

```json
{
  "merchantOwner": "string (optional)",
  "merchantId": "string (optional)",
  "price": "number (required)",
  "payToken": "SOL | USDC (required)",
  "payoutBps": "number (optional)",
  "buybackBps": "number (optional)",
  "burnBps": "number (optional)"
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantOwner` | string | No* | Merchant owner public key (*required if merchantId not provided) |
| `merchantId` | string | No* | Merchant ID (*required if merchantOwner not provided) |
| `price` | number | Yes | Payment price (e.g., 100 for $100) |
| `payToken` | string | Yes | Payment token: "SOL" or "USDC" |
| `payoutBps` | number | No | Override default payout percentage (0-10000) |
| `buybackBps` | number | No | Override default buyback percentage (0-10000) |
| `burnBps` | number | No | Override default burn percentage (0-10000) |

### Validation

- Either `merchantOwner` or `merchantId` must be provided
- `price` must be positive
- `payoutBps + buybackBps` must not exceed 10000
- Merchant must exist and not be frozen
- Payment token must be allowed for merchant

### Response

**Success (200):**

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

**Error (400):**

```json
{
  "error": "Invalid request",
  "details": [
    {
      "path": ["price"],
      "message": "Expected number, received string"
    }
  ]
}
```

**Error (404):**

```json
{
  "error": "Merchant not found"
}
```

**Error (403):**

```json
{
  "error": "Merchant is frozen"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `quoteId` | string | Unique quote identifier (UUID) |
| `merchantId` | string | Merchant ID |
| `amount` | string | Payment amount in token's smallest unit |
| `payToken` | string | Payment token ("SOL" or "USDC") |
| `payoutBps` | number | Payout percentage (basis points) |
| `buybackBps` | number | Buyback percentage (basis points) |
| `burnBps` | number | Burn percentage (basis points) |
| `buybackAmount` | string | Amount allocated for buyback |
| `minOut` | string | Minimum tokens guaranteed (with slippage) |
| `estimatedTokens` | string | Estimated tokens from buyback |
| `slippageBps` | number | Slippage tolerance (basis points) |
| `quote` | object | Full Jupiter quote data |
| `swapTransaction` | string | Base64 encoded Jupiter swap transaction |
| `expiresAt` | number | Quote expiration timestamp (Unix) |

### Example

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

### Important Notes

1. **Quote Expiration:** Quotes expire after 30 seconds. Request a new quote if expired.

2. **Price Conversion:** 
   - SOL: `price * 1e9` (9 decimals)
   - USDC: `price * 1e6` (6 decimals)

3. **Slippage Protection:** `minOut` is calculated with slippage tolerance. The actual swap output must be >= `minOut`.

4. **No Buyback:** If `buybackBps` is 0, `minOut` and `estimatedTokens` will be "0".

## Build Payment Transaction

Build a payment transaction for the buyer to sign.

### Endpoint

```
POST /v2/build-tx
```

### Request Body

```json
{
  "quoteId": "string (required)",
  "merchantId": "string (required)",
  "payer": "string (required)",
  "amount": "string (required)",
  "payToken": "SOL | USDC (required)",
  "minOut": "string (required)",
  "payoutBps": "number (required)",
  "buybackBps": "number (required)",
  "burnBps": "number (required)",
  "swapTransaction": "string (optional)",
  "priorityFee": "number (optional)"
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `quoteId` | string | Yes | Quote ID from quote endpoint |
| `merchantId` | string | Yes | Merchant ID |
| `payer` | string | Yes | Buyer's wallet public key |
| `amount` | string | Yes | Payment amount (from quote) |
| `payToken` | string | Yes | Payment token ("SOL" or "USDC") |
| `minOut` | string | Yes | Minimum output (from quote) |
| `payoutBps` | number | Yes | Payout percentage (from quote) |
| `buybackBps` | number | Yes | Buyback percentage (from quote) |
| `burnBps` | number | Yes | Burn percentage (from quote) |
| `swapTransaction` | string | No | Jupiter swap transaction (from quote) |
| `priorityFee` | number | No | Priority fee in SOL (e.g., 0.0001) |

### Validation

- Quote must not be expired
- Merchant must exist and not be frozen
- `payoutBps + buybackBps` must not exceed 10000
- All amounts must match quote values

### Response

**Success (200):**

```json
{
  "transaction": "base64_encoded_transaction",
  "expiresAt": 1234567890
}
```

**Error (400):**

```json
{
  "error": "Invalid request",
  "details": [
    {
      "path": ["quoteId"],
      "message": "Quote expired"
    }
  ]
}
```

**Error (404):**

```json
{
  "error": "Merchant not found"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `transaction` | string | Base64 encoded Solana transaction |
| `expiresAt` | number | Transaction expiration timestamp |

### Example

```bash
curl -X POST http://localhost:3001/v2/build-tx \
  -H "Content-Type: application/json" \
  -d '{
    "quoteId": "550e8400-e29b-41d4-a716-446655440000",
    "merchantId": "12345678901234567890",
    "payer": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "amount": "100000000",
    "payToken": "USDC",
    "minOut": "1500000000",
    "payoutBps": 7000,
    "buybackBps": 3000,
    "burnBps": 5000,
    "swapTransaction": "base64...",
    "priorityFee": 0.0001
  }'
```

### Transaction Usage

After receiving the transaction, deserialize and sign it:

```typescript
import { VersionedTransaction } from '@solana/web3.js';

const transactionBuffer = Buffer.from(response.transaction, 'base64');
const transaction = VersionedTransaction.deserialize(transactionBuffer);

// Sign with buyer's wallet
transaction.sign([buyerKeypair]);

// Or with wallet adapter
const signed = await wallet.signTransaction(transaction);

// Send to network
const signature = await connection.sendTransaction(signed);
await connection.confirmTransaction(signature);
```

### Important Notes

1. **Transaction Expiration:** Transactions expire after 30 seconds. Build a new transaction if expired.

2. **Priority Fee:** Recommended for faster confirmation, especially during high network congestion.

3. **Transaction Size:** Large transactions (with complex Jupiter routes) may approach Solana's 1232 byte limit.

4. **Error Handling:** If transaction building fails, check:
   - Quote is not expired
   - Merchant is not frozen
   - All parameters match quote values

## Payment Flow

### Complete Example

```typescript
// 1. Get quote
const quote = await axios.post('/v2/quote', {
  merchantId: '12345678901234567890',
  price: 100,
  payToken: 'USDC',
});

// 2. Build transaction
const tx = await axios.post('/v2/build-tx', {
  quoteId: quote.data.quoteId,
  merchantId: quote.data.merchantId,
  payer: buyerPublicKey,
  amount: quote.data.amount,
  payToken: quote.data.payToken,
  minOut: quote.data.minOut,
  payoutBps: quote.data.payoutBps,
  buybackBps: quote.data.buybackBps,
  burnBps: quote.data.burnBps,
  swapTransaction: quote.data.swapTransaction,
  priorityFee: 0.0001,
});

// 3. Sign and send
const transaction = VersionedTransaction.deserialize(
  Buffer.from(tx.data.transaction, 'base64')
);
transaction.sign([buyerKeypair]);
const signature = await connection.sendTransaction(transaction);
```

## Error Handling

### Common Errors

- **Quote Expired:** Request a new quote
- **Merchant Not Found:** Verify merchant ID
- **Merchant Frozen:** Contact merchant or protocol admin
- **Invalid BPS:** Ensure `payoutBps + buybackBps <= 10000`
- **Transaction Build Failed:** Check all parameters match quote

## Next Steps

- [Merchant API](./merchant-api.md) - Merchant management
- [Quick Start Guide](../getting-started/quickstart.md) - Integration guide
- [Payment Flow](../architecture/payment-flow.md) - Detailed flow

