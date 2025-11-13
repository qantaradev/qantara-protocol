# Merchant API

Endpoints for merchant registration and management.

## Register Merchant

Register a new merchant with the Qantara Protocol.

### Endpoint

```
POST /v2/merchants/register
```

### Request Body

```json
{
  "merchantOwner": "string (required)",
  "payoutWallet": "string (required)",
  "buybackMint": "string (required)",
  "defaultPayoutBps": "number (optional, default: 7000)",
  "defaultBuybackBps": "number (optional, default: 3000)",
  "defaultBurnBps": "number (optional, default: 5000)",
  "slippageBps": "number (optional, default: 100)",
  "allowSol": "boolean (optional, default: true)",
  "allowUsdc": "boolean (optional, default: true)",
  "webhookUrl": "string (optional)"
}
```

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantOwner` | string | Yes | Merchant's wallet public key (signer for on-chain registration) |
| `payoutWallet` | string | Yes | Wallet address where payments will be sent |
| `buybackMint` | string | Yes | Community token mint address |
| `defaultPayoutBps` | number | No | Default percentage for merchant payout (0-10000, default: 7000 = 70%) |
| `defaultBuybackBps` | number | No | Default percentage for buyback (0-10000, default: 3000 = 30%) |
| `defaultBurnBps` | number | No | Default percentage of buyback to burn (0-10000, default: 5000 = 50%) |
| `slippageBps` | number | No | Maximum slippage tolerance (0-10000, default: 100 = 1%) |
| `allowSol` | boolean | No | Allow SOL payments (default: true) |
| `allowUsdc` | boolean | No | Allow USDC payments (default: true) |
| `webhookUrl` | string | No | Webhook URL for payment notifications |

### Validation

- `payoutBps + buybackBps` must not exceed 10000
- `merchantOwner` must be a valid Solana public key
- `payoutWallet` must be a valid Solana public key
- `buybackMint` must be a valid Solana public key
- Merchant must not already exist

### Response

**Success (200):**

```json
{
  "merchantId": "12345678901234567890",
  "merchantRegistryPDA": "ABC...XYZ",
  "vaultBuybackToken": "DEF...UVW",
  "status": "registered"
}
```

**Error (400):**

```json
{
  "error": "Invalid request",
  "details": [
    {
      "path": ["payoutBps"],
      "message": "payout + buyback cannot exceed 10000"
    }
  ]
}
```

**Error (409):**

```json
{
  "error": "Merchant already registered",
  "merchantId": "12345678901234567890"
}
```

### Example

```bash
curl -X POST http://localhost:3001/v2/merchants/register \
  -H "Content-Type: application/json" \
  -d '{
    "merchantOwner": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    "payoutWallet": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    "buybackMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "defaultPayoutBps": 7000,
    "defaultBuybackBps": 3000,
    "defaultBurnBps": 5000,
    "slippageBps": 100,
    "allowSol": true,
    "allowUsdc": true
  }'
```

### Important Notes

1. **On-Chain Registration Required:** After API registration, you must complete on-chain registration by calling the `register_merchant` instruction on the smart contract.

2. **Vault Buyback Token:** The API creates a vault buyback token account during registration. This account is required for all payments.

3. **Merchant ID:** The merchant ID is generated using a hash-based algorithm and is unique per merchant.

## Get Merchant

Retrieve merchant information by merchant ID.

### Endpoint

```
GET /v2/merchants/:merchantId
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `merchantId` | string | Yes | Merchant ID |

### Response

**Success (200):**

```json
{
  "merchantId": "12345678901234567890",
  "merchantOwner": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "merchantRegistryPDA": "ABC...XYZ",
  "payoutWallet": "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  "buybackMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "vaultBuybackToken": "DEF...UVW",
  "defaultPayoutBps": 7000,
  "defaultBuybackBps": 3000,
  "defaultBurnBps": 5000,
  "slippageBps": 100,
  "allowSol": true,
  "allowUsdc": true,
  "frozen": false,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

**Error (404):**

```json
{
  "error": "Merchant not found"
}
```

### Example

```bash
curl http://localhost:3001/v2/merchants/12345678901234567890
```

## Update Merchant

Update merchant configuration (coming soon).

### Endpoint

```
PATCH /v2/merchants/:merchantId
```

This endpoint is planned for future release.

## Merchant Status

### Active

Merchant is active and can process payments.

### Frozen

Merchant is frozen and cannot process payments. This can be set by:
- Protocol admin (emergency)
- Merchant owner (self-freeze)

### Paused

Merchant is paused (protocol-level pause affects all merchants).

## Best Practices

1. **Store Merchant ID:** Save the merchant ID returned from registration for all subsequent API calls.

2. **Complete On-Chain Registration:** Always complete on-chain registration after API registration.

3. **Validate Configuration:** Verify merchant configuration before processing payments.

4. **Monitor Status:** Check merchant status (frozen/paused) before each payment.

5. **Handle Errors:** Implement proper error handling for registration failures.

## Next Steps

- [Payment API](./payment-api.md) - Payment processing endpoints
- [Quick Start Guide](../getting-started/quickstart.md) - Integration guide

