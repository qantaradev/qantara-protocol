# Vault Architecture

Qantara Protocol uses a **hybrid vault architecture** that balances efficiency, security, and scalability. This document explains the vault structure in detail.

## Overview

The protocol uses two types of vaults:

1. **Centralized Vaults** - Shared by all merchants (SOL, USDC)
2. **Per-Merchant Vaults** - Individual accounts per merchant (Buyback tokens)

## Centralized Vaults

These vaults are **global** - all merchants use the same accounts.

### Vault SOL (Centralized)

**PDA Derivation:**
```typescript
seeds: [Buffer.from("vault"), Buffer.from("sol")]
programId: QANTARA_V2_PROGRAM_ID
```

**Purpose:**
- Receives all SOL payments from buyers
- Used for merchant payouts (SOL)
- Used for buyback swaps (SOL → buyback_token)
- Shared pool for all merchants

**Why Centralized:**
- ✅ All merchants receive payments in SOL
- ✅ Single account reduces on-chain storage
- ✅ Efficient for swaps (all buybacks use same SOL pool)
- ✅ Simpler account management

**Account Details:**
- **Type:** System Account (SOL balance)
- **Authority:** Program (PDA)
- **Initialization:** Automatic on first use

### Vault USDC (Centralized)

**PDA Derivation:**
```typescript
seeds: [Buffer.from("vault_usdc"), usdcMint.toBuffer()]
programId: QANTARA_V2_PROGRAM_ID
```

**Purpose:**
- Receives all USDC payments from buyers
- Used for merchant payouts (USDC)
- Used for buyback swaps (USDC → SOL → buyback_token)
- Shared pool for all merchants

**Why Centralized:**
- ✅ All merchants receive payments in USDC
- ✅ Single account reduces on-chain storage
- ✅ Efficient for swaps (all buybacks use same USDC pool)
- ✅ Simpler account management

**Account Details:**
- **Type:** Token Account (SPL Token)
- **Authority:** Program (PDA)
- **Initialization:** Requires `init_vault_usdc` instruction

### Protocol Config (Centralized)

**PDA Derivation:**
```typescript
seeds: [Buffer.from("protocol")]
programId: QANTARA_V2_PROGRAM_ID
```

**Purpose:**
- Stores global protocol settings
- Protocol fee configuration
- Jupiter router address
- Protocol wallet address
- Pause mechanism

**Why Centralized:**
- ✅ Single source of truth for protocol settings
- ✅ Efficient updates (one account vs many)
- ✅ Consistent behavior across all merchants

**Account Structure:**
```rust
pub struct ProtocolConfig {
    pub authority: Pubkey,              // Protocol admin
    pub protocol_fee_bps: u16,           // Protocol fee (e.g., 100 = 1%)
    pub protocol_wallet: Pubkey,          // Fee recipient
    pub jupiter_router: Pubkey,           // Jupiter v6 program
    pub paused: bool,                     // Emergency pause
    pub bump: u8,                         // PDA bump
}
```

## Per-Merchant Vaults

These vaults are **individual** - each merchant has their own.

### Merchant Registry (Per Merchant)

**PDA Derivation:**
```typescript
seeds: [
  Buffer.from("merchant"),
  merchantId.toArrayLike(Buffer, "le", 8)
]
programId: QANTARA_V2_PROGRAM_ID
```

**Purpose:**
- Stores merchant-specific configuration
- Payout wallet (validated on-chain)
- Buyback mint (validated on-chain)
- Freeze status
- Merchant owner

**Why Per Merchant:**
- ✅ Each merchant has unique configuration
- ✅ Security: Validates payout wallet on-chain
- ✅ Security: Validates buyback mint on-chain
- ✅ Enables per-merchant freeze mechanism

**Account Structure:**
```rust
pub struct MerchantRegistry {
    pub merchant_id: u64,              // Hash-based merchant ID
    pub owner: Pubkey,                  // Merchant owner
    pub payout_wallet: Pubkey,          // CRITICAL: Validated on-chain
    pub buyback_mint: Pubkey,           // CRITICAL: Validated on-chain
    pub frozen: bool,                    // Emergency freeze
    pub bump: u8,                       // PDA bump
}
```

### Vault Buyback Token (Per Merchant)

**Type:** Regular Token Account (NOT a PDA)

**Purpose:**
- Stores buyback tokens for each merchant
- Used for burning tokens (authority = merchantRegistryPDA)
- Each merchant has their own community token

**Why Per Merchant:**
- ✅ Each merchant has a different buyback mint (community token)
- ✅ Cannot share token accounts across different mints
- ✅ Allows per-merchant tokenomics
- ✅ Enables merchant-specific burn mechanics

**Account Creation:**
```typescript
// Created during merchant registration
const vaultBuybackToken = await createAccount(
  connection,
  merchantOwner,
  buybackMint,              // Merchant's community token
  merchantOwner.publicKey
);

// Authority set to merchant registry PDA (for burning)
await setAuthority(
  connection,
  merchantOwner,
  vaultBuybackToken,
  merchantOwner.publicKey,
  AuthorityType.AccountOwner,
  merchantRegistryPDA
);
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│              CENTRALIZED (Shared by All Merchants)          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Protocol Config PDA                                       │
│  ┌─────────────────────┐                                   │
│  │ seeds: [b"protocol"] │                                   │
│  │ - protocol_fee_bps   │                                   │
│  │ - protocol_wallet    │                                   │
│  │ - jupiter_router     │                                   │
│  │ - paused             │                                   │
│  └─────────────────────┘                                   │
│                                                             │
│  Vault SOL PDA                                             │
│  ┌──────────────────────────┐                             │
│  │ seeds: [b"vault", b"sol"] │                             │
│  │ - Receives all SOL       │                             │
│  │ - Used for payouts       │                             │
│  │ - Used for buyback swaps │                             │
│  └──────────────────────────┘                             │
│                                                             │
│  Vault USDC PDA                                            │
│  ┌──────────────────────────────────┐                     │
│  │ seeds: [b"vault_usdc", usdc_mint] │                     │
│  │ - Receives all USDC              │                     │
│  │ - Used for payouts               │                     │
│  │ - Used for buyback swaps          │                     │
│  └──────────────────────────────────┘                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              PER MERCHANT (Individual Accounts)              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Merchant A                                                 │
│  ┌─────────────────────────────┐                           │
│  │ Merchant Registry PDA       │                           │
│  │ seeds: [b"merchant", id_a]  │                           │
│  │ - payout_wallet             │                           │
│  │ - buyback_mint (Token A)    │                           │
│  └─────────────────────────────┘                           │
│  ┌─────────────────────────────┐                           │
│  │ Vault Buyback Token         │                           │
│  │ - Token account for Token A │                           │
│  │ - Authority: Registry PDA   │                           │
│  └─────────────────────────────┘                           │
│                                                             │
│  Merchant B                                                 │
│  ┌─────────────────────────────┐                           │
│  │ Merchant Registry PDA       │                           │
│  │ seeds: [b"merchant", id_b]  │                           │
│  │ - payout_wallet             │                           │
│  │ - buyback_mint (Token B)    │                           │
│  └─────────────────────────────┘                           │
│  ┌─────────────────────────────┐                           │
│  │ Vault Buyback Token         │                           │
│  │ - Token account for Token B │                           │
│  │ - Authority: Registry PDA   │                           │
│  └─────────────────────────────┘                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Payment Flow with Vaults

### SOL Payment Example

```
Buyer → Vault SOL (CENTRALIZED) → Merchant Payout
                              ↓
                    Buyback Swap: SOL → Token A
                              ↓
                    Vault Buyback Token A (PER MERCHANT)
                              ↓
                    Burn Portion (Authority: Registry PDA)
```

### USDC Payment Example

```
Buyer → Vault USDC (CENTRALIZED) → Merchant Payout
                               ↓
                    Swap 1: USDC → SOL
                               ↓
                    Vault SOL (CENTRALIZED)
                               ↓
                    Swap 2: SOL → Token A
                               ↓
                    Vault Buyback Token A (PER MERCHANT)
                               ↓
                    Burn Portion (Authority: Registry PDA)
```

## Benefits of This Architecture

### Centralized Vaults (SOL/USDC)

**Advantages:**
- ✅ **Efficiency:** Single account reduces on-chain storage
- ✅ **Simplicity:** Easier account management
- ✅ **Liquidity:** Shared pool can improve swap rates
- ✅ **Cost:** Lower rent costs (one account vs many)

**Considerations:**
- ⚠️ **Shared Pool:** All merchants share the same vault
- ⚠️ **Accounting:** Need off-chain tracking per merchant
- ⚠️ **Transparency:** On-chain, all payments visible in one vault

### Per-Merchant Vaults (Buyback Token)

**Advantages:**
- ✅ **Isolation:** Each merchant's tokens are separate
- ✅ **Flexibility:** Different tokenomics per merchant
- ✅ **Security:** Merchant-specific burn authority
- ✅ **Clarity:** Clear ownership per merchant

**Considerations:**
- ⚠️ **Cost:** Each merchant pays for token account rent
- ⚠️ **Management:** Need to create account per merchant

## Account Summary

| Account | Type | Scope | PDA? | Purpose |
|---------|------|-------|------|---------|
| Protocol Config | Centralized | Global | ✅ Yes | Protocol settings |
| Vault SOL | Centralized | Global | ✅ Yes | SOL payments & swaps |
| Vault USDC | Centralized | Global | ✅ Yes | USDC payments & swaps |
| Merchant Registry | Per Merchant | Individual | ✅ Yes | Merchant config |
| Vault Buyback Token | Per Merchant | Individual | ❌ No | Buyback token storage |

## Implementation Notes

### For API Development

1. **Centralized Vaults:**
   - Derive once (same for all merchants)
   - Cache addresses (don't recalculate)
   - Initialize once (protocol setup)

2. **Per-Merchant Vaults:**
   - Derive per merchant (from merchant_id)
   - Create during registration
   - Store in database

3. **Account Derivation:**
   ```typescript
   // Centralized (derive once)
   const [vaultSolPDA] = PublicKey.findProgramAddressSync(
     [Buffer.from("vault"), Buffer.from("sol")],
     programId
   );
   
   // Per merchant (derive per merchant)
   const [merchantRegistryPDA] = PublicKey.findProgramAddressSync(
     [Buffer.from("merchant"), merchantId.toArrayLike(Buffer, "le", 8)],
     programId
   );
   ```

## Security Considerations

### Centralized Vaults
- ✅ **Program Authority:** Vaults are PDAs owned by program
- ✅ **No Direct Access:** Merchants cannot directly access vaults
- ✅ **On-Chain Validation:** All transfers validated by program

### Per-Merchant Vaults
- ✅ **Authority Control:** Buyback token authority = merchant registry PDA
- ✅ **On-Chain Validation:** Buyback mint validated against registry
- ✅ **Isolation:** Each merchant's tokens are separate

## Summary

**Centralized:**
- Vault SOL (one for all merchants)
- Vault USDC (one for all merchants)
- Protocol Config (one for all merchants)

**Per Merchant:**
- Vault Buyback Token (one per merchant)
- Merchant Registry (one per merchant)

This hybrid approach provides:
- ✅ Efficiency for payment tokens (SOL/USDC)
- ✅ Flexibility for community tokens (buyback)
- ✅ Security through on-chain validation
- ✅ Scalability for many merchants

