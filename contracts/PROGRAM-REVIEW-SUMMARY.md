# Qantara V2 Program Review - Summary

## Executive Summary

The Qantara V2 program is a **single, shared program instance** that handles payments for **all merchants**. Each merchant is uniquely identified by a `merchant_id` (u64) and has their own on-chain registry entry (PDA).

---

## Key Architecture Points

### 1. Single Program, Multiple Merchants ✅

- **One program** deployed at: `JCjXHcUy7LzJsLBoafjem9wRffRyuyGYsiTz35Yyr9AH`
- **Multiple merchants** each with unique `merchant_id`
- **Shared vaults** for SOL and USDC (all merchants use same vaults)
- **Per-merchant** buyback token accounts

### 2. Merchant Identification

```typescript
// Merchant ID is generated off-chain (hash-based)
merchant_id = SHA256(merchantOwner + timestamp + random).slice(0, 8)

// Merchant Registry PDA (derived deterministically)
seeds: [b"merchant", merchant_id.to_le_bytes()]
→ merchantRegistryPDA
```

### 3. Account Structure

**Global Accounts (Shared by All Merchants):**
- `protocolConfigPDA` - Protocol settings
- `vaultSolPDA` - SOL vault (shared)
- `vaultUsdcPDA` - USDC vault (shared)

**Per-Merchant Accounts:**
- `merchantRegistryPDA` - Merchant configuration (PDA)
- `vaultBuybackToken` - Buyback token account (NOT a PDA, created by merchant)

---

## What Merchants Control vs What Protocol Provides

### What Merchants Control (Merchant-Provided)

**For Registration (One-Time):**
1. **Merchant Owner Wallet** - PublicKey (their wallet)
2. **Payout Wallet** - PublicKey (where payments go) ✅ MERCHANT CONTROLS
3. **Buyback Mint** - PublicKey (community token) ✅ MERCHANT PROVIDES

**For Each Payment:**
1. **Selling Price** - Number (price in USDC or SOL) ✅ MERCHANT SETS
2. **Payment Token** - "SOL" or "USDC" ✅ MERCHANT CHOOSES
3. **BPS Configuration:** ✅ MERCHANT CONTROLS
   - `payoutBps` - Merchant payout (e.g., 7000 = 70%)
   - `buybackBps` - Buyback amount (e.g., 3000 = 30%)
   - `burnBps` - Burn percentage of buyback (e.g., 5000 = 50%)

### What Protocol Provides (Automatic)

**For Registration:**
- `merchant_id` generation ✅ PROTOCOL GENERATES
- `merchantRegistryPDA` derivation ✅ PROTOCOL DERIVES
- `vaultBuybackToken` account creation ✅ PROTOCOL CREATES
- Merchant data storage ✅ PROTOCOL STORES

**For Each Payment:**
- `amount` calculation (from price) ✅ PROTOCOL CALCULATES
- All PDA derivations ✅ PROTOCOL DERIVES
- Jupiter swap route building ✅ PROTOCOL BUILDS
- Slippage calculation ✅ PROTOCOL CALCULATES
- Transaction construction ✅ PROTOCOL BUILDS
- Account gathering ✅ PROTOCOL GATHERS

---

## Payment Flow Details

### Step-by-Step Execution

1. **Receive Payment**
   - SOL: Transfer from buyer → `vault_sol`
   - USDC: Transfer from buyer → `vault_usdc`

2. **Deduct Protocol Fee**
   - Calculated: `amount × protocol_fee_bps / 10000`
   - Transferred to protocol wallet

3. **Calculate Splits**
   - Remaining = `amount - protocol_fee`
   - Merchant payout = `remaining × payout_bps / 10000`
   - Buyback amount = `remaining × buyback_bps / 10000`

4. **Execute Buyback Swap**
   - **If USDC payment:**
     - Swap 1: `USDC → SOL` (vault_usdc → vault_sol)
     - Swap 2: `SOL → buyback_token` (vault_sol → vault_buyback_token)
   - **If SOL payment:**
     - Swap: `SOL → buyback_token` (vault_sol → vault_buyback_token)

5. **Burn Tokens**
   - Calculate: `buyback_tokens × burn_bps / 10000`
   - Burn from `vault_buyback_token` (authority: merchantRegistryPDA)

6. **Payout Merchant**
   - Transfer merchant payout to `merchant_payout_wallet`

---

## Security Features

The program includes **9 security validations**:

1. ✅ Protocol not paused
2. ✅ Merchant exists and ID matches
3. ✅ Merchant not frozen
4. ✅ Payout wallet matches registry (prevents rerouting attacks)
5. ✅ Buyback mint matches registry
6. ✅ BPS bounds valid (payout + buyback ≤ 10000)
7. ✅ Jupiter router matches protocol config
8. ✅ Slippage protection (minOut > 0 and output ≥ minOut)
9. ✅ Burn BPS ≤ 10000

---

## Critical Implementation Notes

### 1. Vault Buyback Token Account

**IMPORTANT:** Each merchant must create their own `vaultBuybackToken` account:

```typescript
// Create token account
const vaultBuybackToken = await createAccount(
  connection,
  merchantOwner,
  buybackMint,
  merchantOwner.publicKey
);

// Set authority to merchant registry PDA (for burning)
await setAuthority(
  connection,
  merchantOwner,
  vaultBuybackToken,
  merchantOwner.publicKey,
  AuthorityType.AccountOwner,
  merchantRegistryPDA
);
```

**This account must exist before the first payment!**

### 2. Jupiter Swap Route Building

The API must build the correct swap route:

**For SOL payments:**
```typescript
// Single swap: SOL → buyback_token
// Source: vault_sol (PDA)
// Destination: vault_buyback_token (merchant's account)
```

**For USDC payments:**
```typescript
// Two swaps:
// 1. USDC → SOL
//    Source: vault_usdc (PDA)
//    Destination: vault_sol (PDA)
// 2. SOL → buyback_token
//    Source: vault_sol (PDA)
//    Destination: vault_buyback_token (merchant's account)
```

### 3. PDA Derivation

All PDAs must be derived correctly:

```typescript
// Protocol Config
const [protocolConfigPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("protocol")],
  programId
);

// Merchant Registry
const [merchantRegistryPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("merchant"), merchantId.toArrayLike(Buffer, "le", 8)],
  programId
);

// Vault SOL
const [vaultSolPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault"), Buffer.from("sol")],
  programId
);

// Vault USDC
const usdcMint = new PublicKey(USDC_MINT_ADDRESS);
const [vaultUsdcPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("vault_usdc"), usdcMint.toBuffer()],
  programId
);
```

---

## API Requirements Summary

### Endpoints Needed

1. **POST /v1/merchants/register**
   - Generate merchant_id
   - Register merchant on-chain
   - Create vault_buyback_token account
   - Store merchant data

2. **POST /v1/quote**
   - Get merchant config
   - Calculate buyback amount
   - Get Jupiter quote
   - Calculate minOut with slippage

3. **POST /v1/build-tx**
   - Derive all PDAs
   - Build Jupiter swap route
   - Construct settle instruction
   - Return versioned transaction

### Database Schema

**Merchant Table:**
```sql
CREATE TABLE merchants (
  merchant_id BIGINT PRIMARY KEY,
  merchant_owner VARCHAR(44) NOT NULL,
  merchant_registry_pda VARCHAR(44) NOT NULL,
  payout_wallet VARCHAR(44) NOT NULL,
  buyback_mint VARCHAR(44) NOT NULL,
  vault_buyback_token VARCHAR(44) NOT NULL,
  default_payout_bps INTEGER DEFAULT 7000,
  default_buyback_bps INTEGER DEFAULT 3000,
  default_burn_bps INTEGER DEFAULT 5000,
  slippage_bps INTEGER DEFAULT 100,
  allow_sol BOOLEAN DEFAULT true,
  allow_usdc BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Next Steps for API Implementation

1. ✅ **Update Program ID** - Use V2 program ID
2. ✅ **Load V2 IDL** - From `contracts/target/idl/qantara_v2.json`
3. ✅ **Implement PDA Helpers** - Derive all PDAs correctly
4. ✅ **Implement Jupiter Integration** - Build multi-hop swap routes
5. ✅ **Implement Transaction Builder** - Construct settle instruction with all accounts
6. ✅ **Add Merchant Registration** - Endpoint to register merchants
7. ✅ **Update Database Schema** - Match V2 structure

---

## Documentation Files

- **MERCHANT-PAYMENT-REQUIREMENTS.md** - Detailed requirements and account structure
- **PAYMENT-FLOW-DIAGRAM.md** - Visual flow diagrams
- **PROGRAM-REVIEW-SUMMARY.md** - This summary document

---

## Key Takeaways

1. **Single Program Instance** - All merchants use the same program
2. **Merchant ID** - Unique identifier per merchant (hash-based)
3. **PDA Derivation** - All accounts derived deterministically
4. **Vault Buyback Token** - Per-merchant account (NOT a PDA)
5. **Jupiter Integration** - Off-chain builder constructs swap routes
6. **Security** - On-chain validations prevent attacks
7. **Flexibility** - Merchants can set per-payment or default BPS

---

## Questions to Consider

1. **Merchant ID Generation:** Should it be deterministic (e.g., from merchant owner) or random?
2. **Default BPS:** Should merchants set defaults or provide per-payment?
3. **Vault Buyback Token:** Should API create it automatically or require merchant to create?
4. **Jupiter Slippage:** What default slippage tolerance? (Currently 1% in tests)
5. **Payment Limits:** Should there be min/max payment amounts?

---

## Ready for API Implementation

All program details are documented. The API can now be implemented with:
- ✅ Clear understanding of account structure
- ✅ PDA derivation formulas
- ✅ Payment flow requirements
- ✅ Security validations
- ✅ Jupiter integration requirements

