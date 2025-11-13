# Architecture Overview

This document provides a comprehensive overview of the Qantara Protocol architecture, including system design, components, and data flow.

## System Architecture

Qantara Protocol is built on Solana and consists of three main components:

```
┌─────────────────────────────────────────────────────────┐
│                    Qantara Protocol                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Smart      │  │   API        │  │   Checkout   │ │
│  │   Contract   │  │   Server     │  │   UI         │ │
│  │   (Anchor)   │  │   (Node.js)  │  │   (Next.js)  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│         │                  │                  │          │
│         └──────────────────┴──────────────────┘         │
│                          │                              │
│                    ┌─────▼─────┐                        │
│                    │  Solana   │                        │
│                    │  Network  │                        │
│                    └───────────┘                        │
│                          │                              │
│                    ┌─────▼─────┐                        │
│                    │  Jupiter  │                        │
│                    │  Aggregator│                       │
│                    └───────────┘                        │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Smart Contract (Qantara V2)

**Location:** `contracts/programs/qantara-v2/`

**Technology:** Rust + Anchor Framework

**Program ID:** `JCjXHcUy7LzJsLBoafjem9wRffRyuyGYsiTz35Yyr9AH`

**Key Features:**
- On-chain merchant registry
- Payment settlement with security validations
- Automatic token buyback via Jupiter
- Protocol-enforced token burning
- Protocol configuration management

**Main Instructions:**
- `init_protocol` - Initialize protocol (admin only)
- `update_protocol` - Update protocol settings (admin only)
- `register_merchant` - Register a new merchant
- `update_merchant` - Update merchant configuration
- `settle` - Execute payment settlement

### 2. API Server

**Location:** `apps/api-server/`

**Technology:** Node.js + Express + TypeScript

**Key Features:**
- Merchant registration and management
- Payment quote generation
- Transaction building
- Jupiter integration
- Database management

**Main Endpoints:**
- `POST /v2/merchants/register` - Register merchant
- `GET /v2/merchants/:merchantId` - Get merchant info
- `POST /v2/quote` - Get payment quote
- `POST /v2/build-tx` - Build payment transaction

### 3. Checkout UI (Optional)

**Location:** `apps/checkout-ui/`

**Technology:** Next.js + React + TypeScript

**Purpose:** Pre-built checkout interface for merchants

## Account Architecture

Qantara uses a hybrid vault architecture with both centralized and per-merchant accounts.

### Centralized Accounts (Shared by All Merchants)

#### Protocol Config PDA
```
Seeds: [b"protocol"]
Purpose: Global protocol settings
```

#### Vault SOL PDA
```
Seeds: [b"vault", b"sol"]
Purpose: Receives all SOL payments
```

#### Vault USDC PDA
```
Seeds: [b"vault_usdc", usdc_mint]
Purpose: Receives all USDC payments
```

### Per-Merchant Accounts

#### Merchant Registry PDA
```
Seeds: [b"merchant", merchant_id.to_le_bytes()]
Purpose: Merchant-specific configuration
```

#### Vault Buyback Token
```
Type: Regular token account (NOT PDA)
Purpose: Stores buyback tokens per merchant
Authority: Merchant Registry PDA
```

For detailed vault architecture, see [Vault Architecture](./vault-architecture.md).

## Payment Flow

### High-Level Flow

```
1. Buyer initiates payment
   ↓
2. Merchant requests quote from API
   ↓
3. API generates Jupiter swap quote
   ↓
4. API builds transaction
   ↓
5. Buyer signs transaction
   ↓
6. Transaction executed on-chain
   ↓
7. Protocol splits payment:
   - Protocol fee → Protocol wallet
   - Merchant payout → Merchant wallet
   - Buyback amount → Jupiter swap → Buyback tokens
   - Burn portion → Token burn
```

### Detailed Payment Flow

See [Payment Flow Documentation](./payment-flow.md) for step-by-step details.

## Security Architecture

Qantara implements 8 comprehensive security validations:

1. **Protocol Pause Protection** - Prevents operations when paused
2. **Merchant ID Validation** - Ensures merchant exists
3. **Merchant Freeze Protection** - Prevents frozen merchants
4. **Payout Wallet Validation** - Prevents rerouting attacks
5. **Buyback Mint Validation** - Prevents wrong token attacks
6. **BPS Bounds Validation** - Prevents overflow
7. **Jupiter Router Allowlist** - Validates swap router
8. **Slippage Protection** - Ensures minimum output

For detailed security information, see [Security Documentation](../security/overview.md).

## Data Flow

### Merchant Registration Flow

```
Merchant → API Server → Database
              ↓
         On-Chain Registration
              ↓
         Merchant Registry PDA
```

### Payment Processing Flow

```
Buyer → Quote Request → API Server → Jupiter API
                              ↓
                    Transaction Builder
                              ↓
                    Buyer Signs Transaction
                              ↓
                    Solana Network
                              ↓
                    Smart Contract Execution
                              ↓
                    Payment Split & Buyback
```

## Integration Points

### Jupiter Aggregator

Qantara integrates with Jupiter for token swaps:

- **Purpose:** Optimal swap routes for buyback
- **Integration:** Via Jupiter API
- **Routes:**
  - SOL → Buyback Token (single hop)
  - USDC → SOL → Buyback Token (multi-hop)

### Solana Network

- **Network Support:** Devnet and Mainnet
- **Transaction Format:** Versioned Transactions
- **Confirmation:** Confirmed commitment level

## Scalability Considerations

### Centralized Vaults

- **Benefit:** Single account reduces on-chain storage
- **Trade-off:** Shared pool requires off-chain accounting

### Per-Merchant Accounts

- **Benefit:** Isolation and flexibility
- **Trade-off:** Each merchant pays rent

### Transaction Throughput

- **Solana Capacity:** ~3,000 TPS
- **Qantara Impact:** Single transaction per payment
- **Bottleneck:** Jupiter API rate limits

## Upgrade Path

### Program Upgrades

Qantara V2 uses a program-derived address (PDA) architecture that supports:
- Program upgrades via upgrade authority
- Backward-compatible IDL changes
- State migration if needed

### Versioning

- **V1:** Legacy version (deprecated)
- **V2:** Current production version
- **API:** Versioned endpoints (`/v1/`, `/v2/`)

## Monitoring and Observability

### On-Chain Events

The protocol emits events for:
- Protocol initialization
- Protocol pause/unpause
- Merchant registration
- Merchant freeze/unfreeze
- Payment settlement

### Off-Chain Logging

API server logs:
- Request/response details
- Error traces
- Performance metrics

## Next Steps

- [Vault Architecture](./vault-architecture.md) - Detailed vault design
- [Payment Flow](./payment-flow.md) - Step-by-step payment process
- [Security Overview](../security/overview.md) - Security architecture
- [API Documentation](../api/overview.md) - API reference

