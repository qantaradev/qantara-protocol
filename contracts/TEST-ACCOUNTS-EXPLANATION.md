# Test Accounts Explanation

## Why We Need These Accounts

### 1. `protocolAuthority` ✅ NEEDS FUNDING
- **Role:** Signs `init_protocol` transaction
- **Needs:** ~0.001 SOL (transaction fees)
- **Why:** Must sign to initialize protocol config

### 2. `merchantOwner` ✅ NEEDS FUNDING  
- **Role:** Signs `register_merchant` transaction
- **Needs:** ~0.001 SOL (transaction fees)
- **Why:** Must sign to register merchant

### 3. `buyer` ✅ NEEDS FUNDING
- **Role:** Signs payment transactions and pays
- **Needs:** Payment amount + ~0.001 SOL (fees)
- **Why:** Must sign and pay for the transaction

### 4. `protocolWallet` ❌ DOESN'T NEED FUNDING
- **Role:** Receives protocol fees (passive)
- **Needs:** 0 SOL
- **Why:** It's just a destination, doesn't sign anything

### 5. `merchantPayoutWallet` ❌ DOESN'T NEED FUNDING
- **Role:** Receives merchant payouts (passive)
- **Needs:** 0 SOL
- **Why:** It's just a destination, doesn't sign anything

## Current Problem

We're funding:
- 4 accounts × 10 SOL = **40 SOL total** ❌
- But we only need:
  - `protocolAuthority`: 0.1 SOL (enough for many transactions)
  - `merchantOwner`: 0.1 SOL (enough for many transactions)
  - `buyer`: 1 SOL (enough for test payments + fees)
  - `protocolWallet`: 0 SOL (doesn't need funding)
  - **Total: ~1.2 SOL** ✅

## Solution

Reduce funding amounts and skip funding passive accounts.


