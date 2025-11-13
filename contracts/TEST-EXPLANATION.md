# V2 Test Suite Explanation

## Overview

The V2 test suite is an **end-to-end integration test** that validates the Qantara V2 payment protocol smart contract. It tests the complete payment flow from protocol setup to payment settlement, with a focus on **security validations**.

## Test Structure

### 1. Setup Phase (`before` hook)

**What it does:**
- Generates test keypairs (protocol authority, merchant owner, buyer, etc.)
- Funds test accounts with SOL (transfers from your wallet or airdrops)
- Creates test tokens:
  - **USDC mint**: Simulates USDC token for payments
  - **Buyback mint**: Simulates the merchant's community token
- Generates a **merchant_id** (hash-based, unique identifier)
- Derives PDAs (Program Derived Addresses) for:
  - `ProtocolConfig`: Global protocol settings
  - `MerchantRegistry`: On-chain merchant registration

**Why:** Sets up a realistic test environment with all necessary accounts and tokens.

---

### 2. Protocol Initialization Tests

**Test: "Initializes protocol configuration"**

**What it does:**
- Calls `init_protocol` instruction
- Sets protocol fee (1% = 100 basis points)
- Sets protocol wallet (where fees go)
- Sets Jupiter router address (for swaps)
- Verifies the config was stored correctly on-chain

**Why:** Ensures the protocol can be initialized and settings are stored correctly.

---

### 3. Merchant Registration Tests

**Test: "Registers a merchant with on-chain registry"**

**What it does:**
- Calls `register_merchant` instruction
- Registers:
  - `merchant_id`: Unique identifier
  - `payout_wallet`: Where merchant receives payments
  - `buyback_mint`: Token to buy back
- Verifies the merchant registry was created correctly

**Why:** Ensures merchants can register and their data is stored on-chain (critical for security).

**Test: "Fails to register with wrong merchant_id"**

**What it does:**
- Tries to register with a wrong `merchant_id` but correct PDA
- Expects the transaction to fail

**Why:** Validates that PDA derivation is correct and prevents account mismatches.

---

### 4. Payment Settlement - Security Tests

These are the **most important tests** - they validate security measures.

#### Test: "Fails settlement with wrong payout wallet (rerouting attack)"

**What it does:**
- Tries to settle a payment with an **attacker's wallet** instead of the registered payout wallet
- Expects the transaction to fail with `InvalidPayoutWallet` error

**Why:** **Prevents rerouting attacks** - ensures payments can only go to the wallet registered on-chain, not to an attacker's wallet.

#### Test: "Fails settlement with wrong buyback mint"

**What it does:**
- Tries to settle with a different buyback token than registered
- Expects the transaction to fail with `InvalidBuybackMint` error

**Why:** Ensures merchants can't be tricked into buying back the wrong token.

#### Test: "Fails settlement with invalid BPS (payout + buyback > 100%)"

**What it does:**
- Tries to settle with payout (70%) + buyback (40%) = 110% (invalid)
- Expects the transaction to fail with `InvalidBasisPoints` error

**Why:** Prevents invalid split configurations that would over-allocate funds.

#### Test: "Fails settlement when protocol is paused"

**What it does:**
- Pauses the protocol
- Tries to settle a payment
- Expects the transaction to fail with `ProtocolPaused` error
- Unpauses the protocol after the test

**Why:** Allows emergency shutdown of the protocol if needed.

#### Test: "Fails settlement when merchant is frozen"

**What it does:**
- Freezes the merchant account
- Tries to settle a payment
- Expects the transaction to fail with `MerchantFrozen` error
- Unfreezes the merchant after the test

**Why:** Allows freezing individual merchants if they're compromised or fraudulent.

---

## What's NOT Tested (Yet)

The test suite currently focuses on **security validations** (negative tests - ensuring things fail correctly). It doesn't yet test:

1. **Successful payment settlement** - A complete end-to-end payment flow
2. **SOL payment flow** - Customer pays with SOL
3. **USDC payment flow** - Customer pays with USDC
4. **Buyback and burn** - Verifying tokens are actually bought and burned
5. **Protocol fee collection** - Verifying fees are collected correctly
6. **Split calculations** - Verifying payout/buyback splits are correct

## Test Philosophy

The tests follow a **security-first approach**:
- ✅ **Negative tests** (what should fail) - Most tests
- ⏳ **Positive tests** (what should work) - To be added

This is because:
1. Security is critical - we need to ensure attacks are prevented
2. Positive tests require more setup (Jupiter integration, actual swaps)
3. Security tests validate the core security model

## Next Steps

To complete the test suite, we should add:
1. Successful SOL payment settlement test
2. Successful USDC payment settlement test
3. Buyback verification (check tokens were bought)
4. Burn verification (check tokens were burned)
5. Fee verification (check protocol fees were collected)
6. Balance checks (verify all splits are correct)

