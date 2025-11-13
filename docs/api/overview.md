# API Overview

The Qantara Protocol API provides a RESTful interface for integrating payment processing into your application.

## Base URL

- **Development:** `http://localhost:3001`
- **Production:** `https://api.qantara.protocol` (TBD)

## API Versioning

The API uses versioned endpoints:

- **V1:** `/v1/*` - Legacy (deprecated)
- **V2:** `/v2/*` - Current production version

All new integrations should use V2 endpoints.

## Authentication

Currently, the API does not require authentication for public endpoints. Future versions may implement API keys for rate limiting and usage tracking.

## Response Format

### Success Response

```json
{
  "data": { /* response data */ }
}
```

### Error Response

```json
{
  "error": "Error message",
  "details": [ /* validation errors */ ]
}
```

## HTTP Status Codes

- `200` - Success
- `400` - Bad Request (validation error)
- `404` - Not Found (merchant not found)
- `403` - Forbidden (merchant frozen)
- `500` - Internal Server Error

## Rate Limiting

Rate limiting is not currently implemented but may be added in future versions. Consider implementing client-side rate limiting for production use.

## Endpoints

### Merchant Management

- `POST /v2/merchants/register` - Register a new merchant
- `GET /v2/merchants/:merchantId` - Get merchant information

### Payment Processing

- `POST /v2/quote` - Get payment quote
- `POST /v2/build-tx` - Build payment transaction

### Health Check

- `GET /health` - API health status

## Quick Start

### 1. Register Merchant

```bash
curl -X POST http://localhost:3001/v2/merchants/register \
  -H "Content-Type: application/json" \
  -d '{
    "merchantOwner": "YOUR_WALLET",
    "payoutWallet": "YOUR_PAYOUT_WALLET",
    "buybackMint": "YOUR_TOKEN_MINT"
  }'
```

### 2. Get Quote

```bash
curl -X POST http://localhost:3001/v2/quote \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "YOUR_MERCHANT_ID",
    "price": 100,
    "payToken": "USDC"
  }'
```

### 3. Build Transaction

```bash
curl -X POST http://localhost:3001/v2/build-tx \
  -H "Content-Type: application/json" \
  -d '{
    "quoteId": "QUOTE_ID",
    "merchantId": "YOUR_MERCHANT_ID",
    "payer": "BUYER_WALLET",
    "amount": "100000000",
    "payToken": "USDC",
    "minOut": "1500000000",
    "payoutBps": 7000,
    "buybackBps": 3000,
    "burnBps": 5000,
    "swapTransaction": "BASE64_SWAP_TX"
  }'
```

## Detailed Documentation

- [Merchant API](./merchant-api.md) - Merchant management endpoints
- [Payment API](./payment-api.md) - Payment processing endpoints

## SDK Support

Official SDKs are planned for:
- TypeScript/JavaScript
- Python
- Go

Community SDKs are welcome!

## Support

For API support:
- GitHub Issues: [qantaradev/qantara-protocol/issues](https://github.com/qantaradev/qantara-protocol/issues)
- Documentation: [docs/](../)

