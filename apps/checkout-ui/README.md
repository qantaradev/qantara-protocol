# Qantara Checkout UI

Frontend checkout interface for Qantara payments. Allows buyers to pay with SOL or USDC and automatically executes buyback and burn operations.

## Features

- 🔌 **Wallet Integration**: Connect with Phantom, Solflare, and other Solana wallets
- 💰 **Multi-token Support**: Pay with SOL or USDC
- 📊 **Real-time Quotes**: Live price quotes with breakdown
- ✅ **Transaction Signing**: Secure transaction signing and submission
- 🔗 **Block Explorer**: Direct links to view transactions

## Quick Start

### Prerequisites

- Node.js 18+
- API server running (see `apps/api-server`)

### Installation

```bash
cd apps/checkout-ui
npm install
```

### Configuration

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
```

### Development

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) and navigate to `/checkout/[merchantId]`

### Production Build

```bash
npm run build
npm start
```

## Usage

### Checkout URL

```
http://localhost:3001/checkout/[merchantId]
```

Replace `[merchantId]` with your merchant ID.

### Example

```
http://localhost:3001/checkout/1234567890
```

## Environment Variables

- `NEXT_PUBLIC_API_URL` - API server URL (default: `http://localhost:3000`)
- `NEXT_PUBLIC_RPC_URL` - Solana RPC endpoint (default: devnet)

## Features

### Wallet Connection

Uses `@solana/wallet-adapter-react` for wallet integration. Supports:
- Phantom
- Solflare
- And other Solana wallets

### Payment Flow

1. User enters amount and selects payment token
2. System fetches quote from API
3. User connects wallet
4. User clicks "Pay" button
5. Transaction is built, signed, and submitted
6. Success confirmation with transaction link

## Development

### Project Structure

```
apps/checkout-ui/
├── app/
│   ├── layout.tsx          # Root layout with wallet provider
│   ├── checkout/
│   │   └── [merchantId]/
│   │       └── page.tsx    # Checkout page
│   └── globals.css         # Global styles
├── components/
│   └── WalletProvider.tsx  # Wallet adapter setup
└── package.json
```

## License

Apache 2.0 - See [LICENSE](../../LICENSE) for details.


