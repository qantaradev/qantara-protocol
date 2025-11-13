# Qantara API Server

REST API server for the Qantara payment protocol. Provides endpoints for merchant registration, payment quotes, and transaction building.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp env.example .env
# Edit .env with your configuration

# Run database migrations
psql $DATABASE_URL -f ../../db/migrations/001_initial_schema.sql
psql $DATABASE_URL -f ../../db/migrations/002_v2_merchant_schema.sql

# Start development server
npm run dev
```

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Solana RPC endpoint (devnet or mainnet)
- Service wallet (for creating vault accounts)

## 🔧 Configuration

### Environment Variables

See [env.example](./env.example) for all available options.

**Required:**
- `RPC_URL` - Solana RPC endpoint
- `DATABASE_URL` - PostgreSQL connection string
- `SERVICE_WALLET_PRIVATE_KEY` - Base64 encoded service wallet private key

**Optional:**
- `API_PORT` - Server port (default: 3000)
- `JUPITER_API_URL` - Jupiter API endpoint
- `ALLOWED_ORIGINS` - CORS allowed origins
- `NODE_ENV` - Environment (development/production)

### Network Configuration

The API automatically detects the network from `RPC_URL`:
- **Devnet**: `https://api.devnet.solana.com`
- **Mainnet**: `https://api.mainnet-beta.solana.com` (or private RPC)

USDC mint addresses are automatically selected based on the network.

## 📡 API Endpoints

### V2 Endpoints (Current)

#### `POST /v2/quote`
Get payment quote with Jupiter swap routing.

**Request:**
```json
{
  "merchantId": "1234567890",
  "price": 10.0,
  "payToken": "SOL",
  "buybackBps": 3000,
  "payoutBps": 7000
}
```

**Response:**
```json
{
  "quoteId": "uuid",
  "merchantId": "1234567890",
  "amount": "10000000000",
  "payToken": "SOL",
  "payoutBps": 7000,
  "buybackBps": 3000,
  "burnBps": 5000,
  "buybackAmount": "3000000000",
  "minOut": "245000000",
  "estimatedTokens": "250000000",
  "slippageBps": 100,
  "quote": { ... },
  "swapTransaction": "base64-encoded",
  "expiresAt": 1730000000
}
```

#### `POST /v2/build-tx`
Build versioned transaction for payment settlement.

**Request:**
```json
{
  "quoteId": "uuid",
  "merchantId": "1234567890",
  "payer": "BuyerWalletAddress",
  "amount": "10000000000",
  "payToken": "SOL",
  "minOut": "245000000",
  "payoutBps": 7000,
  "buybackBps": 3000,
  "burnBps": 5000,
  "swapTransaction": "base64-encoded-jupiter-tx"
}
```

**Response:**
```json
{
  "transaction": "base64-encoded-versioned-tx",
  "expiresAt": 1730000000
}
```

#### `POST /v2/merchants/register`
Register a new merchant.

**Request:**
```json
{
  "merchantOwner": "MerchantWalletAddress",
  "payoutWallet": "PayoutWalletAddress",
  "buybackMint": "TokenMintAddress",
  "defaultPayoutBps": 7000,
  "defaultBuybackBps": 3000,
  "defaultBurnBps": 5000,
  "slippageBps": 100,
  "allowSol": true,
  "allowUsdc": true
}
```

**Response:**
```json
{
  "merchantId": "1234567890",
  "merchantRegistryPDA": "PDAAddress",
  "vaultBuybackToken": "TokenAccountAddress",
  "status": "registered"
}
```

#### `GET /v2/merchants/:merchantId`
Get merchant information.

**Response:**
```json
{
  "merchantId": "1234567890",
  "merchantOwner": "MerchantWalletAddress",
  "merchantRegistryPDA": "PDAAddress",
  "payoutWallet": "PayoutWalletAddress",
  "buybackMint": "TokenMintAddress",
  "vaultBuybackToken": "TokenAccountAddress",
  "defaultPayoutBps": 7000,
  "defaultBuybackBps": 3000,
  "defaultBurnBps": 5000,
  "slippageBps": 100,
  "allowSol": true,
  "allowUsdc": true,
  "frozen": false
}
```

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1730000000
}
```

## 🧪 Testing

```bash
# Run foundation tests (PDA derivation, IDL loading, etc.)
npm run test:foundation

# Run Jupiter integration tests
npm run test:jupiter

# Run all tests
npm test
```

## 📦 Development

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 🔐 Security

- ✅ Input validation with Zod schemas
- ✅ CORS origin restrictions
- ✅ Error message sanitization
- ✅ Environment variable validation
- ✅ Service wallet security

See [SECURITY-CHECKLIST.md](./SECURITY-CHECKLIST.md) for complete security guidelines.

## 📚 Documentation

- **[API V2 Implementation](./API-V2-IMPLEMENTATION.md)** - Detailed API documentation
- **[Demo Setup](./DEMO-SETUP.md)** - Setup guide for demos
- **[Jupiter Integration](./JUPITER-INTEGRATION.md)** - Jupiter swap integration
- **[Deployment Guide](../docs/DEPLOYMENT.md)** - Production deployment

## 🐛 Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for common issues and solutions.

## 📄 License

Apache 2.0 - See [LICENSE](../LICENSE) for details.
