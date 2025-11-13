# Qantara V2 - Merchant Payment Requirements

## Overview

This document explains how the Qantara V2 program works and what elements merchants need to provide for successful payments. The same program instance handles **all merchants** - each merchant is identified by a unique `merchant_id` and has their own on-chain registry entry (PDA).

---

## Program Architecture

### Single Program, Multiple Merchants

The Qantara V2 program (`JCjXHcUy7LzJsLBoafjem9wRffRyuyGYsiTz35Yyr9AH`) is a **shared program** that handles payments for all merchants. Each merchant has:

1. **Unique Merchant ID** (`merchant_id: u64`) - Hash-based identifier
2. **Merchant Registry PDA** - On-chain account storing merchant configuration
3. **Vault Buyback Token Account** - Token account for storing buyback tokens (per merchant)

### Key PDAs (Program Derived Addresses)

**Architecture:** Hybrid - Centralized vaults for payment tokens (SOL/USDC), per-merchant vaults for buyback tokens.

```typescript
// CENTRALIZED (Shared by all merchants)
// Protocol Config (GLOBAL - one for all merchants)
seeds: [b"protocol"]
PDA: protocolConfigPDA

// Vault SOL (GLOBAL - shared by all merchants)
seeds: [b"vault", b"sol"]
PDA: vaultSolPDA

// Vault USDC (GLOBAL - shared by all merchants)
seeds: [b"vault_usdc", usdc_mint.key().as_ref()]
PDA: vaultUsdcPDA

// PER MERCHANT (Individual accounts)
// Merchant Registry (PER MERCHANT)
seeds: [b"merchant", merchant_id.to_le_bytes()]
PDA: merchantRegistryPDA

// Vault Buyback Token (PER MERCHANT - NOT a PDA)
// Regular token account, one per merchant for their buyback mint
// Created during registration, authority = merchantRegistryPDA
```

**Why This Architecture:**
- ✅ **Centralized SOL/USDC vaults:** All merchants use same payment tokens, efficient and simple
- ✅ **Per-merchant buyback vaults:** Each merchant has different community token, needs separate account
- ✅ **See VAULT-ARCHITECTURE.md for detailed explanation**

---

## Merchant Registration Flow

### Step 1: Generate Merchant ID

The merchant ID is a **hash-based identifier** generated off-chain:

```typescript
import { createHash } from "crypto";

function generateMerchantId(merchantOwner: PublicKey): BN {
  const hash = createHash("sha256")
    .update(
      Buffer.from(
        merchantOwner.toBase58() +
        Date.now().toString() +
        Math.random().toString()
      )
    )
    .digest();
  return new BN(hash.slice(0, 8), "le");
}
```

**Important:** The merchant ID must be:
- Unique per merchant
- Generated deterministically (or stored after first generation)
- Used consistently for all operations

### Step 2: Derive Merchant Registry PDA

```typescript
const [merchantRegistryPDA, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from("merchant"), merchantId.toArrayLike(Buffer, "le", 8)],
  programId
);
```

### Step 3: Register Merchant On-Chain

```typescript
await program.methods
  .registerMerchant(
    merchantId,
    payoutWallet,      // Where merchant receives payments
    buybackMint        // Community token mint for buyback
  )
  .accounts({
    merchantRegistry: merchantRegistryPDA,
    owner: merchantOwner,  // Merchant owner wallet (signer)
    systemProgram: SystemProgram.programId,
  })
  .signers([merchantOwner])
  .rpc();
```

### Step 4: Create Vault Buyback Token Account

Each merchant needs a **token account** for their buyback mint. This is NOT a PDA - it's a regular token account:

```typescript
// Create token account for buyback mint
const vaultBuybackToken = await createAccount(
  connection,
  merchantOwner,
  buybackMint,
  merchantOwner.publicKey  // Initial owner
);

// Transfer authority to merchant registry PDA (for burning)
await setAuthority(
  connection,
  merchantOwner,
  vaultBuybackToken,
  merchantOwner.publicKey,
  AuthorityType.AccountOwner,
  merchantRegistryPDA  // Program uses this for burning tokens
);
```

**Important:** This account must exist before the first payment. The merchant should store this address.

---

## Payment Settlement Flow

### What Merchants Must Provide for Each Payment

**IMPORTANT:** Merchants only need to provide business logic - the protocol handles all technical details.

#### 1. **Merchant Identification** (Provided by Merchant)
```typescript
{
  merchantOwner: PublicKey,     // Merchant's wallet (for lookup)
  // OR
  merchantId: string,           // Merchant ID (if stored)
}
```

#### 2. **Payment Configuration** (MERCHANT CONTROLS)
```typescript
{
  price: number,                // Selling price (MERCHANT SETS)
  payToken: "SOL" | "USDC",     // Payment token type (MERCHANT CHOOSES)
  payoutBps: number,            // Basis points for merchant payout (MERCHANT SETS, e.g., 7000 = 70%)
  buybackBps: number,            // Basis points for buyback (MERCHANT SETS, e.g., 3000 = 30%)
  burnOfBuybackBps: number,      // Basis points of buyback to burn (MERCHANT SETS, e.g., 5000 = 50% of buyback)
}
```

**Note:** `amount` is calculated from `price` by the API.

**Validation:** `payoutBps + buybackBps <= 10000` (100%)

#### 3. **Buyer Information** (From Payment Request)
```typescript
{
  payer: PublicKey,              // Buyer's wallet (from wallet connection)
}
```

### What Protocol Provides (Automatic)

The API automatically handles:

#### 1. **Account Derivation** (PROTOCOL PROVIDES)
```typescript
{
  // All PDAs derived automatically
  protocolConfigPDA: PublicKey,      // Derived: [b"protocol"]
  vaultSolPDA: PublicKey,             // Derived: [b"vault", b"sol"]
  vaultUsdcPDA: PublicKey,            // Derived: [b"vault_usdc", usdc_mint]
  merchantRegistryPDA: PublicKey,     // Derived: [b"merchant", merchant_id]
  
  // From protocol config (fetched automatically)
  protocolWallet: PublicKey,          // From protocol config
  protocolWalletUsdc: PublicKey,     // Derived from protocol wallet
  jupiterRouter: PublicKey,           // From protocol config
  
  // From merchant registry (fetched automatically)
  merchantPayoutWallet: PublicKey,    // From merchant registry
  buybackMint: PublicKey,             // From merchant registry
  vaultBuybackToken: PublicKey,      // Stored in database
  
  // System accounts (known constants)
  usdcMint: PublicKey,                 // USDC mint (known)
  tokenProgram: TOKEN_PROGRAM_ID,      // Known constant
  systemProgram: SystemProgram.programId, // Known constant
}
```

#### 2. **Jupiter Swap Route** (PROTOCOL BUILDS)

The API automatically builds the Jupiter swap route:

**For SOL payments:**
- Route: `SOL → buyback_token`
- Source: `vault_sol` (PDA)
- Destination: `vault_buyback_token` (from merchant data)

**For USDC payments:**
- Route: `USDC → SOL → buyback_token` (TWO swaps)
  1. `USDC → SOL` (from `vault_usdc` to `vault_sol`)
  2. `SOL → buyback_token` (from `vault_sol` to `vault_buyback_token`)

**Slippage Protection:**
```typescript
{
  minOut: BN,  // Calculated automatically by API with slippage tolerance
}
```

#### 3. **Transaction Building** (PROTOCOL BUILDS)

The API automatically:
- Calculates `amount` from `price`
- Fetches Jupiter quote
- Calculates `minOut` with slippage
- Builds swap route accounts
- Constructs settle instruction
- Adds all accounts
- Serializes transaction

---

## Complete Payment Transaction Structure

### Settle Instruction

```typescript
await program.methods
  .settle(
    merchantId,           // u64: Merchant's unique ID
    amount,               // u64: Payment amount
    { sol: {} } | { usdc: {} },  // PayToken enum
    minOut,               // u64: Minimum buyback tokens (slippage protection)
    payoutBps,            // u16: Merchant payout basis points
    buybackBps,           // u16: Buyback basis points
    burnOfBuybackBps      // u16: Burn percentage of buyback
  )
  .accounts({
    protocolConfig: protocolConfigPDA,
    merchantRegistry: merchantRegistryPDA,
    payer: buyer.publicKey,
    vaultSol: vaultSolPDA,
    vaultUsdc: vaultUsdcPDA,
    usdcMint: usdcMint,
    vaultBuybackToken: vaultBuybackToken,  // Merchant's token account
    buybackMint: buybackMint,
    protocolWallet: protocolWallet.publicKey,
    protocolWalletUsdc: protocolWalletUsdcAccount,
    merchantPayoutWallet: merchantPayoutWallet.publicKey,
    merchantPayoutUsdc: merchantPayoutUsdcAccount,
    payerUsdcAccount: buyerUsdcAccount,  // Only if USDC payment
    jupiterRouter: JUPITER_ROUTER,
    tokenProgram: TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  })
  .remainingAccounts(jupiterSwapAccounts)  // Jupiter swap route accounts
  .signers([buyer])
  .rpc();
```

---

## Security Validations (On-Chain)

The program performs these security checks automatically:

1. ✅ **Protocol not paused** - Checks `protocol_config.paused`
2. ✅ **Merchant exists** - Validates `merchant_id` matches registry
3. ✅ **Merchant not frozen** - Checks `merchant_registry.frozen`
4. ✅ **Payout wallet validation** - Prevents rerouting attacks
5. ✅ **Buyback mint validation** - Ensures correct token
6. ✅ **BPS bounds** - Validates `payout_bps + buyback_bps <= 10000`
7. ✅ **Jupiter router validation** - Ensures correct router program
8. ✅ **Slippage protection** - Validates `min_out > 0` and output >= `min_out`

---

## Merchant Control vs Protocol Control

### What Merchants Control (Merchant-Provided)

Merchants have full control over:

1. **Community Token Mint** (`buyback_mint`)
   - Provided by merchant
   - Their community token for buyback

2. **Payment Splits** (BPS Configuration)
   - `payoutBps` - Percentage to merchant (e.g., 7000 = 70%)
   - `buybackBps` - Percentage for buyback (e.g., 3000 = 30%)
   - `burnBps` - Percentage of buyback to burn (e.g., 5000 = 50%)

3. **Selling Price**
   - Price in USDC or SOL
   - Set by merchant per product/payment

4. **Payout Wallet**
   - Wallet address that receives merchant's share
   - Can be updated by merchant owner

### What Protocol Provides (Automatic)

The protocol handles all technical details:

1. **Program & Accounts**
   - Program ID
   - Protocol config PDA
   - Vault PDAs (SOL, USDC)
   - Merchant registry PDA derivation
   - All account derivations

2. **Jupiter Integration**
   - Swap route building
   - Multi-hop routing (USDC→SOL→buyback_token)
   - Slippage calculation
   - Quote fetching

3. **Transaction Building**
   - Instruction construction
   - Account gathering
   - Remaining accounts setup
   - Transaction serialization

4. **System Accounts**
   - USDC mint address
   - Jupiter router program
   - Token program
   - System program

5. **Vault Buyback Token**
   - Account creation (if needed)
   - Authority management
   - Account address storage

## What Merchants Need to Store

### Merchant-Controlled Data

```typescript
interface MerchantData {
  // Core identification (provided by merchant)
  merchantOwner: string,           // PublicKey base58 (merchant's wallet)
  payoutWallet: string,            // PublicKey base58 (where payments go - MERCHANT CONTROLS)
  buybackMint: string,             // PublicKey base58 (community token - MERCHANT PROVIDES)
  
  // Payment configuration (MERCHANT CONTROLS)
  defaultPayoutBps: number,        // Default: 7000 (70%) - MERCHANT SETS
  defaultBuybackBps: number,       // Default: 3000 (30%) - MERCHANT SETS
  defaultBurnBps: number,          // Default: 5000 (50% of buyback) - MERCHANT SETS
  
  // Payment settings (MERCHANT CONTROLS)
  allowSol: boolean,               // MERCHANT SETS
  allowUsdc: boolean,              // MERCHANT SETS
  
  // Per-payment (MERCHANT CONTROLS)
  price: number,                   // Price in USDC or SOL - MERCHANT SETS
  payToken: "SOL" | "USDC",       // Payment token - MERCHANT CHOOSES
}
```

### Protocol-Provided Data (Stored by API)

```typescript
interface ProtocolData {
  // Program & Accounts (PROTOCOL PROVIDES)
  programId: string,               // "JCjXHcUy7LzJsLBoafjem9wRffRyuyGYsiTz35Yyr9AH"
  protocolConfigPDA: string,      // Derived automatically
  vaultSolPDA: string,            // Derived automatically
  vaultUsdcPDA: string,           // Derived automatically
  
  // System Accounts (PROTOCOL PROVIDES)
  usdcMint: string,                // USDC mint address (known)
  jupiterRouter: string,          // Jupiter v6 program (from protocol config)
  protocolWallet: string,          // Protocol fee recipient (from protocol config)
  
  // Merchant Registry (DERIVED BY PROTOCOL)
  merchantId: string,             // Generated by protocol
  merchantRegistryPDA: string,    // Derived by protocol
  vaultBuybackToken: string,      // Created by protocol (stored for merchant)
}
```

---

## Payment Flow Example

### Scenario: $100 USDC Payment

**Merchant Configuration:**
- `payoutBps`: 7000 (70%)
- `buybackBps`: 3000 (30%)
- `burnBps`: 5000 (50% of buyback)

**Calculation:**
1. **Protocol Fee:** 1% = 1 USDC (from protocol config)
2. **Remaining:** 99 USDC
3. **Merchant Payout:** 99 × 70% = 69.3 USDC
4. **Buyback Amount:** 99 × 30% = 29.7 USDC

**Jupiter Swap:**
- Route: `29.7 USDC → SOL → buyback_token`
- Expected output: e.g., 245,000 tokens (based on market price)
- `minOut`: 245,000 × 99% = 242,550 (1% slippage)

**Burn:**
- Buyback tokens received: 245,000
- Burn amount: 245,000 × 50% = 122,500 tokens

**Result:**
- ✅ Merchant receives: 69.3 USDC
- ✅ Protocol receives: 1 USDC
- ✅ Buyback tokens: 245,000 (122,500 burned, 122,500 in vault)

---

## API Requirements

### What the API Must Do (Protocol Responsibilities)

The API handles ALL technical details - merchants only provide business logic.

1. **Merchant Registration Endpoint** (`POST /v1/merchants/register`)
   - **Merchant provides:**
     - `merchantOwner` (wallet)
     - `payoutWallet` (where payments go)
     - `buybackMint` (community token)
     - Optional: default BPS settings
   
   - **API handles:**
     - Generate `merchant_id`
     - Derive `merchantRegistryPDA`
     - Call `register_merchant` instruction
     - Create `vault_buyback_token` account
     - Set authority to merchant registry PDA
     - Store all merchant data in database
     - Return merchant ID and registry PDA

2. **Quote Endpoint** (`POST /v1/quote`)
   - **Merchant provides:**
     - `merchantOwner` or `merchantId`
     - `price` (in USDC or SOL)
     - `payToken` ("SOL" or "USDC")
     - `payoutBps`, `buybackBps`, `burnBps` (or use defaults)
   
   - **API handles:**
     - Lookup merchant from database
     - Calculate `amount` from `price`
     - Calculate buyback amount
     - Get Jupiter quote for swap route
     - Calculate `minOut` with slippage
     - Return quote with route accounts

3. **Transaction Builder** (`POST /v1/build-tx`)
   - **Merchant provides:**
     - `quoteId` (from quote endpoint)
     - `payer` (buyer's wallet - from wallet connection)
   
   - **API handles:**
     - Load quote and merchant data
     - Derive all PDAs automatically
     - Build Jupiter swap route (USDC→SOL→buyback or SOL→buyback)
     - Construct `settle` instruction
     - Add all accounts automatically
     - Add swap accounts as `remaining_accounts`
     - Serialize versioned transaction
     - Return transaction for signing

4. **Account Derivation Helpers** (Internal API Functions)
   ```typescript
   // Protocol provides all account derivations
   function deriveProtocolAccounts(programId: PublicKey) {
     const [protocolConfigPDA] = PublicKey.findProgramAddressSync(
       [Buffer.from("protocol")],
       programId
     );
     const [vaultSolPDA] = PublicKey.findProgramAddressSync(
       [Buffer.from("vault"), Buffer.from("sol")],
       programId
     );
     const usdcMint = new PublicKey(USDC_MINT);
     const [vaultUsdcPDA] = PublicKey.findProgramAddressSync(
       [Buffer.from("vault_usdc"), usdcMint.toBuffer()],
       programId
     );
     return { protocolConfigPDA, vaultSolPDA, vaultUsdcPDA };
   }
   
   function deriveMerchantAccounts(merchantId: BN, programId: PublicKey) {
     const [merchantRegistryPDA] = PublicKey.findProgramAddressSync(
       [Buffer.from("merchant"), merchantId.toArrayLike(Buffer, "le", 8)],
       programId
     );
     return { merchantRegistryPDA };
   }
   ```

---

## Key Takeaways

### Merchant Control (What Merchants Provide)
1. ✅ **Community Token Mint** - Their token for buyback
2. ✅ **Payment Splits** - BPS configuration (payout, buyback, burn)
3. ✅ **Selling Price** - Price in USDC or SOL
4. ✅ **Payout Wallet** - Where they receive payments

### Protocol Control (What API Provides)
1. ✅ **Program & Accounts** - All PDAs, program ID, system accounts
2. ✅ **Jupiter Integration** - Swap route building, quote fetching
3. ✅ **Transaction Building** - Instruction construction, account gathering
4. ✅ **Vault Management** - Buyback token account creation/management
5. ✅ **Security** - On-chain validations, slippage protection

### Architecture
1. **Single Program:** All merchants use the same program instance
2. **Merchant ID:** Unique identifier per merchant (generated by protocol)
3. **PDA Derivation:** All accounts derived automatically by API
4. **Vault Buyback Token:** Created by protocol, stored for merchant
5. **Jupiter Integration:** API builds swap routes automatically
6. **Security:** On-chain validations prevent rerouting and wrong mint attacks
7. **Payment Flexibility:** Merchants control splits and price per payment

---

## Next Steps for API Implementation

1. ✅ Update program ID to V2
2. ✅ Load V2 IDL
3. ✅ Implement PDA derivation helpers (all automatic)
4. ✅ Implement Jupiter swap route building (USDC→SOL→buyback)
5. ✅ Implement transaction builder (all accounts automatic)
6. ✅ Add merchant registration endpoint (create vault_buyback_token)
7. ✅ Update database schema (store protocol-provided data)
8. ✅ Implement quote endpoint (calculate from merchant price)
9. ✅ Implement build-tx endpoint (all technical details handled)

