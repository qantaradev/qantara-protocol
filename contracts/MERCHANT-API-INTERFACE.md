# Qantara V2 - Merchant API Interface

## Overview

This document defines the **merchant-facing API interface**. Merchants only need to provide business logic (price, splits, token choice) - the protocol handles all technical details automatically.

---

## Merchant Registration

### Endpoint: `POST /v1/merchants/register`

**What Merchant Provides:**
```typescript
{
  merchantOwner: string,        // Merchant's wallet (PublicKey base58)
  payoutWallet: string,         // Where payments go (PublicKey base58) - MERCHANT CONTROLS
  buybackMint: string,          // Community token mint (PublicKey base58) - MERCHANT PROVIDES
  defaultPayoutBps?: number,     // Optional: Default payout % (default: 7000 = 70%)
  defaultBuybackBps?: number,   // Optional: Default buyback % (default: 3000 = 30%)
  defaultBurnBps?: number,      // Optional: Default burn % (default: 5000 = 50%)
  allowSol?: boolean,           // Optional: Allow SOL payments (default: true)
  allowUsdc?: boolean,          // Optional: Allow USDC payments (default: true)
}
```

**What Protocol Handles:**
- ✅ Generate `merchant_id`
- ✅ Derive `merchantRegistryPDA`
- ✅ Call `register_merchant` instruction
- ✅ Create `vault_buyback_token` account
- ✅ Set authority to merchant registry PDA
- ✅ Store all data in database

**Response:**
```typescript
{
  merchantId: string,           // Generated merchant ID
  merchantRegistryPDA: string,   // Merchant registry PDA address
  vaultBuybackToken: string,     // Buyback token account address
  status: "registered"
}
```

---

## Get Payment Quote

### Endpoint: `POST /v1/quote`

**What Merchant Provides:**
```typescript
{
  merchantOwner: string,        // OR merchantId: string
  price: number,                // Selling price (MERCHANT SETS)
  payToken: "SOL" | "USDC",     // Payment token (MERCHANT CHOOSES)
  payoutBps?: number,           // Optional: Override default payout % (MERCHANT CONTROLS)
  buybackBps?: number,          // Optional: Override default buyback % (MERCHANT CONTROLS)
  burnBps?: number,             // Optional: Override default burn % (MERCHANT CONTROLS)
}
```

**What Protocol Handles:**
- ✅ Lookup merchant from database
- ✅ Calculate `amount` from `price`
- ✅ Calculate buyback amount
- ✅ Get Jupiter quote for swap route
- ✅ Calculate `minOut` with slippage
- ✅ Build swap route accounts

**Response:**
```typescript
{
  quoteId: string,              // UUID for quote
  merchantId: string,           // Merchant ID
  amount: string,               // Calculated amount (from price)
  payToken: "SOL" | "USDC",
  payoutBps: number,            // Actual payout BPS used
  buybackBps: number,           // Actual buyback BPS used
  burnBps: number,              // Actual burn BPS used
  buybackAmount: string,        // Amount allocated for buyback
  minOut: string,               // Minimum tokens expected (slippage protection)
  estimatedTokens: string,      // Estimated buyback tokens
  expiresAt: number,            // Quote expiration timestamp
}
```

---

## Build Payment Transaction

### Endpoint: `POST /v1/build-tx`

**What Merchant Provides:**
```typescript
{
  quoteId: string,              // From quote endpoint
  payer: string,                // Buyer's wallet (PublicKey base58) - from wallet connection
}
```

**What Protocol Handles:**
- ✅ Load quote and merchant data
- ✅ Derive all PDAs automatically
- ✅ Build Jupiter swap route
- ✅ Construct `settle` instruction
- ✅ Add all accounts automatically
- ✅ Serialize transaction

**Response:**
```typescript
{
  transaction: string,           // Base64-encoded versioned transaction
  expiresAt: number,            // Transaction expiration timestamp
  instructions: {
    settle: {
      merchantId: string,
      amount: string,
      payToken: "SOL" | "USDC",
      minOut: string,
      payoutBps: number,
      buybackBps: number,
      burnBps: number,
    }
  }
}
```

---

## Update Merchant Configuration

### Endpoint: `PATCH /v1/merchants/:merchantId`

**What Merchant Provides:**
```typescript
{
  payoutWallet?: string,        // Update payout wallet (MERCHANT CONTROLS)
  buybackMint?: string,         // Update buyback mint (MERCHANT PROVIDES)
  defaultPayoutBps?: number,    // Update default payout % (MERCHANT CONTROLS)
  defaultBuybackBps?: number,   // Update default buyback % (MERCHANT CONTROLS)
  defaultBurnBps?: number,      // Update default burn % (MERCHANT CONTROLS)
  allowSol?: boolean,           // Update SOL payment allowance (MERCHANT CONTROLS)
  allowUsdc?: boolean,          // Update USDC payment allowance (MERCHANT CONTROLS)
}
```

**What Protocol Handles:**
- ✅ Validate merchant ownership
- ✅ Call `update_merchant` instruction (if on-chain changes)
- ✅ Update database

**Response:**
```typescript
{
  merchantId: string,
  updated: string[],           // List of updated fields
  status: "updated"
}
```

---

## Get Merchant Info

### Endpoint: `GET /v1/merchants/:merchantId`

**What Merchant Provides:**
- Nothing (merchant ID in URL)

**What Protocol Handles:**
- ✅ Fetch merchant data from database
- ✅ Fetch on-chain registry data

**Response:**
```typescript
{
  merchantId: string,
  merchantOwner: string,
  merchantRegistryPDA: string,
  payoutWallet: string,         // MERCHANT CONTROLS
  buybackMint: string,          // MERCHANT PROVIDES
  vaultBuybackToken: string,     // PROTOCOL CREATED
  defaultPayoutBps: number,      // MERCHANT CONTROLS
  defaultBuybackBps: number,    // MERCHANT CONTROLS
  defaultBurnBps: number,       // MERCHANT CONTROLS
  allowSol: boolean,            // MERCHANT CONTROLS
  allowUsdc: boolean,           // MERCHANT CONTROLS
  frozen: boolean,               // From on-chain registry
  createdAt: string,
  updatedAt: string,
}
```

---

## Summary: Merchant vs Protocol Responsibilities

### ✅ Merchant Controls
- **Payout Wallet** - Where payments go
- **Buyback Mint** - Community token
- **Payment Splits** - BPS configuration (payout, buyback, burn)
- **Selling Price** - Price in USDC or SOL
- **Payment Token** - SOL or USDC choice

### ✅ Protocol Provides
- **Program & Accounts** - All PDAs, program ID, system accounts
- **Merchant ID** - Generation and storage
- **Vault Buyback Token** - Account creation and management
- **Jupiter Integration** - Swap route building, quote fetching
- **Transaction Building** - Instruction construction, account gathering
- **Slippage Protection** - Automatic calculation
- **Security** - On-chain validations

---

## Example: Complete Payment Flow

### 1. Merchant Registration (One-Time)
```typescript
// Merchant provides
POST /v1/merchants/register
{
  merchantOwner: "7xK...",
  payoutWallet: "9xB...",      // MERCHANT CONTROLS
  buybackMint: "PUMP_MINT",    // MERCHANT PROVIDES
  defaultPayoutBps: 7000,      // MERCHANT CONTROLS
  defaultBuybackBps: 3000,     // MERCHANT CONTROLS
  defaultBurnBps: 5000          // MERCHANT CONTROLS
}

// Protocol handles everything else
```

### 2. Get Quote
```typescript
// Merchant provides
POST /v1/quote
{
  merchantOwner: "7xK...",
  price: 100,                   // MERCHANT SETS (e.g., $100)
  payToken: "USDC",             // MERCHANT CHOOSES
  // Uses default BPS or can override
}

// Protocol calculates amount, gets Jupiter quote, calculates minOut
```

### 3. Build Transaction
```typescript
// Merchant provides
POST /v1/build-tx
{
  quoteId: "uuid",
  payer: "buyer_wallet"         // From wallet connection
}

// Protocol builds complete transaction with all accounts
```

### 4. Buyer Signs & Submits
```typescript
// Buyer signs transaction and submits
// Protocol handles all on-chain execution
```

---

## Key Points

1. **Merchants only provide business logic** - price, splits, token choice
2. **Protocol handles all technical details** - PDAs, accounts, swaps, transactions
3. **Simple API interface** - Merchants don't need to understand Solana/Anchor
4. **Flexible configuration** - Merchants control splits and price per payment
5. **Secure by default** - All security validations handled on-chain

