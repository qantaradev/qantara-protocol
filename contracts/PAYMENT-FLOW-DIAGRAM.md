# Qantara V2 Payment Flow - Visual Guide

## Merchant Registration (One-Time Setup)

```
┌─────────────────────────────────────────────────────────────┐
│                    MERCHANT REGISTRATION                     │
└─────────────────────────────────────────────────────────────┘

Step 1: Generate Merchant ID
┌─────────────────┐
│ merchantOwner   │ → SHA256(owner + timestamp + random)
│ (PublicKey)     │ → merchant_id (u64)
└─────────────────┘

Step 2: Derive Merchant Registry PDA
┌─────────────────┐
│ seeds:          │
│ - "merchant"    │ → findProgramAddressSync()
│ - merchant_id   │ → merchantRegistryPDA
└─────────────────┘

Step 3: Register On-Chain
┌─────────────────────────────────────┐
│ register_merchant(                  │
│   merchant_id,                      │
│   payout_wallet,                    │
│   buyback_mint                      │
│ )                                   │
│                                     │
│ Creates: MerchantRegistry account  │
│ - merchant_id                       │
│ - owner                            │
│ - payout_wallet                    │
│ - buyback_mint                     │
│ - frozen = false                   │
└─────────────────────────────────────┘

Step 4: Create Vault Buyback Token Account
┌─────────────────────────────────────┐
│ createAccount(                      │
│   buybackMint,                      │
│   merchantOwner                     │
│ )                                   │
│                                     │
│ Then: setAuthority(                 │
│   vaultBuybackToken,                │
│   AuthorityType.AccountOwner,       │
│   merchantRegistryPDA               │
│ )                                   │
└─────────────────────────────────────┘
```

---

## Payment Flow (Per Transaction)

### SOL Payment Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    SOL PAYMENT FLOW                         │
└─────────────────────────────────────────────────────────────┘

BUYER                    VAULT                    MERCHANT
  │                        │                         │
  │ 1. Transfer SOL        │                         │
  ├───────────────────────>│                         │
  │                        │                         │
  │                        │ 2. Protocol Fee (1%)    │
  │                        ├────────────────────────>│ Protocol Wallet
  │                        │                         │
  │                        │ 3. Buyback (30%)       │
  │                        │    Swap: SOL → Token   │
  │                        ├────────────────────────>│ Jupiter Router
  │                        │                         │
  │                        │ 4. Burn (50% of buyback)│
  │                        │    ┌────────────────────┤
  │                        │    │ Burn tokens       │
  │                        │    └───────────────────┤
  │                        │                         │
  │                        │ 5. Payout (70%)        │
  │                        ├────────────────────────>│ Merchant Wallet
  │                        │                         │
```

### USDC Payment Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USDC PAYMENT FLOW                        │
└─────────────────────────────────────────────────────────────┘

BUYER                    VAULT                    MERCHANT
  │                        │                         │
  │ 1. Transfer USDC       │                         │
  ├───────────────────────>│ vault_usdc              │
  │                        │                         │
  │                        │ 2. Protocol Fee (1%)    │
  │                        ├────────────────────────>│ Protocol Wallet USDC
  │                        │                         │
  │                        │ 3. Buyback (30%)        │
  │                        │    Swap 1: USDC → SOL   │
  │                        │    ┌────────────────────┤
  │                        │    │ vault_usdc →      │
  │                        │    │ vault_sol          │
  │                        │    └───────────────────┤
  │                        │    Swap 2: SOL → Token │
  │                        │    ┌────────────────────┤
  │                        │    │ vault_sol →        │
  │                        │    │ vault_buyback_token│
  │                        │    └───────────────────┤
  │                        │                         │
  │                        │ 4. Burn (50% of buyback)│
  │                        │    ┌────────────────────┤
  │                        │    │ Burn tokens        │
  │                        │    └───────────────────┤
  │                        │                         │
  │                        │ 5. Payout (70%)        │
  │                        ├────────────────────────>│ Merchant Wallet USDC
  │                        │                         │
```

---

## Account Derivation Map

```
┌─────────────────────────────────────────────────────────────┐
│              ACCOUNT DERIVATION (All PDAs)                  │
└─────────────────────────────────────────────────────────────┘

GLOBAL ACCOUNTS (Same for all merchants)
┌─────────────────────────────────────────────────────────────┐
│ Protocol Config                                             │
│ seeds: [b"protocol"]                                        │
│ → protocolConfigPDA                                         │
│                                                             │
│ Vault SOL                                                   │
│ seeds: [b"vault", b"sol"]                                    │
│ → vaultSolPDA                                               │
│                                                             │
│ Vault USDC                                                  │
│ seeds: [b"vault_usdc", usdc_mint.key()]                    │
│ → vaultUsdcPDA                                              │
└─────────────────────────────────────────────────────────────┘

PER-MERCHANT ACCOUNTS
┌─────────────────────────────────────────────────────────────┐
│ Merchant Registry                                            │
│ seeds: [b"merchant", merchant_id.to_le_bytes()]             │
│ → merchantRegistryPDA                                       │
│                                                             │
│ Vault Buyback Token                                         │
│ NOT a PDA - regular token account                           │
│ Created by merchant, authority = merchantRegistryPDA       │
│ → vaultBuybackToken (stored in merchant data)              │
└─────────────────────────────────────────────────────────────┘
```

---

## Transaction Structure

```
┌─────────────────────────────────────────────────────────────┐
│              SETTLE TRANSACTION STRUCTURE                   │
└─────────────────────────────────────────────────────────────┘

VersionedTransaction {
  instructions: [
    // Optional: Priority fee
    ComputeBudgetProgram.setComputeUnitPrice(...),
    
    // Main: Settle instruction
    settle {
      accounts: {
        // Protocol accounts (GLOBAL)
        protocolConfig: protocolConfigPDA,
        vaultSol: vaultSolPDA,
        vaultUsdc: vaultUsdcPDA,
        protocolWallet: protocolWallet,
        protocolWalletUsdc: protocolWalletUsdc,
        jupiterRouter: JUPITER_ROUTER,
        
        // Merchant accounts (PER MERCHANT)
        merchantRegistry: merchantRegistryPDA,
        merchantPayoutWallet: merchantPayoutWallet,
        merchantPayoutUsdc: merchantPayoutUsdc,
        vaultBuybackToken: vaultBuybackToken,  // Merchant's account
        buybackMint: buybackMint,
        
        // Payer accounts (FROM BUYER)
        payer: buyer.publicKey,
        payerUsdcAccount: buyerUsdcAccount,  // If USDC
        
        // System
        usdcMint: USDC_MINT,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      },
      
      args: {
        merchant_id: merchantId,
        amount: amount,
        pay_token: { sol: {} } | { usdc: {} },
        min_out: minOut,
        payout_bps: payoutBps,
        buyback_bps: buybackBps,
        burn_of_buyback_bps: burnBps,
      },
      
      // Jupiter swap accounts (dynamic)
      remaining_accounts: [
        // For SOL payment: SOL → buyback_token accounts
        // For USDC payment: USDC → SOL → buyback_token accounts
        ...jupiterSwapAccounts
      ]
    }
  ],
  
  signers: [buyer]
}
```

---

## Data Flow: API → Program

```
┌─────────────────────────────────────────────────────────────┐
│                    API → PROGRAM FLOW                       │
└─────────────────────────────────────────────────────────────┘

1. MERCHANT REQUEST
   ┌─────────────────┐
   │ Merchant sends: │
   │ - merchantId    │
   │ - amount        │
   │ - payToken      │
   └────────┬────────┘
            │
            ▼
2. API LOOKUP
   ┌─────────────────────────────────┐
   │ Database lookup:                │
   │ - merchantRegistryPDA            │
   │ - payoutWallet                   │
   │ - buybackMint                    │
   │ - vaultBuybackToken              │
   │ - defaultBps                     │
   └────────┬─────────────────────────┘
            │
            ▼
3. PDA DERIVATION
   ┌─────────────────────────────────┐
   │ Derive:                         │
   │ - protocolConfigPDA              │
   │ - vaultSolPDA                    │
   │ - vaultUsdcPDA                   │
   │ - merchantRegistryPDA            │
   └────────┬─────────────────────────┘
            │
            ▼
4. JUPITER QUOTE
   ┌─────────────────────────────────┐
   │ Calculate buyback amount        │
   │ Get Jupiter quote:               │
   │ - USDC → SOL → buyback_token    │
   │   OR                             │
   │ - SOL → buyback_token            │
   │ Calculate minOut (slippage)     │
   └────────┬─────────────────────────┘
            │
            ▼
5. TRANSACTION BUILD
   ┌─────────────────────────────────┐
   │ Build settle instruction        │
   │ Add Jupiter swap accounts       │
   │ Serialize transaction           │
   └────────┬─────────────────────────┘
            │
            ▼
6. RETURN TO MERCHANT
   ┌─────────────────────────────────┐
   │ Return:                         │
   │ - transaction (base64)          │
   │ - expiresAt                     │
   └─────────────────────────────────┘
```

---

## Security Checkpoints

```
┌─────────────────────────────────────────────────────────────┐
│              SECURITY VALIDATIONS (On-Chain)                 │
└─────────────────────────────────────────────────────────────┘

settle() instruction execution:

1. Protocol Check
   ┌─────────────────┐
   │ protocol.paused?│ → ❌ FAIL if paused
   └─────────────────┘

2. Merchant Check
   ┌─────────────────────────────────┐
   │ merchant.merchant_id ==         │ → ❌ FAIL if mismatch
   │   provided_merchant_id?          │
   │ merchant.frozen?                 │ → ❌ FAIL if frozen
   └─────────────────────────────────┘

3. Payout Wallet Check
   ┌─────────────────────────────────┐
   │ provided_payout_wallet ==        │ → ❌ FAIL if mismatch
   │   merchant.payout_wallet?        │ (prevents rerouting)
   └─────────────────────────────────┘

4. Buyback Mint Check
   ┌─────────────────────────────────┐
   │ provided_buyback_mint ==         │ → ❌ FAIL if mismatch
   │   merchant.buyback_mint?         │
   └─────────────────────────────────┘

5. BPS Validation
   ┌─────────────────────────────────┐
   │ payout_bps + buyback_bps <=      │ → ❌ FAIL if > 10000
   │   10000?                         │
   └─────────────────────────────────┘

6. Router Validation
   ┌─────────────────────────────────┐
   │ provided_router ==              │ → ❌ FAIL if mismatch
   │   protocol.jupiter_router?      │
   └─────────────────────────────────┘

7. Slippage Check
   ┌─────────────────────────────────┐
   │ buyback_output >= min_out?       │ → ❌ FAIL if slippage
   └─────────────────────────────────┘
```

---

## Summary: What Merchants Need

### Required for Registration
- ✅ Merchant owner wallet (PublicKey)
- ✅ Payout wallet (PublicKey)
- ✅ Buyback mint (PublicKey - community token)

### Required for Each Payment
- ✅ Merchant ID (u64)
- ✅ Payment amount
- ✅ Payment token (SOL or USDC)
- ✅ Payout BPS (basis points)
- ✅ Buyback BPS (basis points)
- ✅ Burn BPS (basis points of buyback)
- ✅ Jupiter swap route (built by API)
- ✅ Slippage protection (minOut)

### Stored by Merchant
- ✅ Merchant ID
- ✅ Merchant Registry PDA
- ✅ Vault Buyback Token account address
- ✅ Default BPS settings (optional)

### Derived by API
- ✅ All PDAs (protocol, vault, merchant registry)
- ✅ Token accounts (protocol wallet, merchant payout)
- ✅ Jupiter swap route accounts

