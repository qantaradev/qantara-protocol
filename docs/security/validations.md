# Security Validations

Detailed documentation of all security validations in Qantara Protocol.

## Validation Overview

Every payment transaction goes through 8 security validations before execution. These validations are executed in order and must all pass for the transaction to succeed.

## Validation Order

The validations are executed in this specific order:

1. Protocol Pause Check
2. Merchant ID Validation
3. Merchant Freeze Check
4. Payout Wallet Validation
5. Buyback Mint Validation
6. BPS Bounds Validation
7. Jupiter Router Validation
8. Slippage Protection

## Detailed Validations

### 1. Protocol Pause Check

**Code:**
```rust
require!(!protocol_config.paused, QantaraError::ProtocolPaused);
```

**Purpose:** Prevents all operations when protocol is paused

**When It Fails:**
- Protocol admin has paused the protocol
- Emergency shutdown activated

**Error:** `ProtocolPaused`

**Recovery:** Wait for protocol to be unpaused

**Use Cases:**
- Emergency response to vulnerabilities
- Protocol upgrades
- Critical bug fixes

### 2. Merchant ID Validation

**Code:**
```rust
require!(
    merchant.merchant_id == merchant_id,
    QantaraError::InvalidMerchantId
);
```

**Purpose:** Ensures merchant exists and ID matches

**When It Fails:**
- Merchant ID doesn't exist
- Merchant ID mismatch
- Merchant registry not initialized

**Error:** `InvalidMerchantId`

**Recovery:** Verify merchant ID and ensure merchant is registered

**Attack Prevented:** Payments to non-existent merchants

### 3. Merchant Freeze Check

**Code:**
```rust
require!(!merchant.frozen, QantaraError::MerchantFrozen);
```

**Purpose:** Prevents payments to frozen merchants

**When It Fails:**
- Merchant has been frozen by owner
- Merchant has been frozen by protocol admin

**Error:** `MerchantFrozen`

**Recovery:** Contact merchant or protocol admin

**Use Cases:**
- Suspicious activity
- Compliance issues
- Merchant request

### 4. Payout Wallet Validation

**Code:**
```rust
require_keys_eq!(
    ctx.accounts.merchant_payout_wallet.key(),
    merchant.payout_wallet,
    QantaraError::InvalidPayoutWallet
);
```

**Purpose:** Prevents rerouting attacks

**When It Fails:**
- Payout wallet in transaction doesn't match registry
- Attacker tries to redirect payment

**Error:** `InvalidPayoutWallet`

**Recovery:** Use correct payout wallet from merchant registry

**Attack Prevented:** Rerouting attacks

**Security Impact:** Critical - prevents fund theft

### 5. Buyback Mint Validation

**Code:**
```rust
require_keys_eq!(
    ctx.accounts.buyback_mint.key(),
    merchant.buyback_mint,
    QantaraError::InvalidBuybackMint
);
```

**Purpose:** Prevents wrong token attacks

**When It Fails:**
- Buyback mint in transaction doesn't match registry
- Attacker tries to use different token

**Error:** `InvalidBuybackMint`

**Recovery:** Use correct buyback mint from merchant registry

**Attack Prevented:** Wrong token attacks

**Security Impact:** Critical - prevents token manipulation

### 6. BPS Bounds Validation

**Code:**
```rust
require!(
    payout_bps.checked_add(buyback_bps).unwrap_or(10001) <= 10000,
    QantaraError::InvalidBasisPoints
);
require!(
    burn_of_buyback_bps <= 10000,
    QantaraError::InvalidBasisPoints
);
```

**Purpose:** Prevents overflow and invalid splits

**When It Fails:**
- `payout_bps + buyback_bps > 10000`
- `burn_of_buyback_bps > 10000`
- Integer overflow detected

**Error:** `InvalidBasisPoints`

**Recovery:** Ensure percentages are valid and sum correctly

**Attack Prevented:** Overflow attacks, invalid percentage splits

**Security Impact:** High - prevents calculation errors

### 7. Jupiter Router Validation

**Code:**
```rust
require_keys_eq!(
    ctx.accounts.jupiter_router.key(),
    protocol_config.jupiter_router,
    QantaraError::InvalidRouterProgram
);
```

**Purpose:** Validates swap router

**When It Fails:**
- Jupiter router in transaction doesn't match protocol config
- Attacker tries to use malicious router

**Error:** `InvalidRouterProgram`

**Recovery:** Use correct Jupiter router from protocol config

**Attack Prevented:** Malicious router attacks

**Security Impact:** Critical - prevents swap manipulation

### 8. Slippage Protection

**Code:**
```rust
if buyback_bps > 0 {
    require!(min_out > 0, QantaraError::InvalidMinOut);
    require!(
        buyback_output >= min_out,
        QantaraError::SlippageExceeded
    );
}
```

**Purpose:** Protects against unfavorable swaps

**When It Fails:**
- `min_out` is 0 when buyback is enabled
- Actual swap output < `min_out`
- Price moved unfavorably

**Error:** `SlippageExceeded` or `InvalidMinOut`

**Recovery:** 
- Increase slippage tolerance
- Retry transaction
- Check market conditions

**Attack Prevented:** Slippage attacks, unfavorable swaps

**Security Impact:** Medium - protects against price manipulation

## Validation Flow Diagram

```
Payment Transaction
        ↓
┌───────────────────────┐
│ 1. Protocol Paused?   │ → NO → Continue
│    YES → FAIL          │
└───────────────────────┘
        ↓
┌───────────────────────┐
│ 2. Merchant ID Valid?  │ → YES → Continue
│    NO → FAIL           │
└───────────────────────┘
        ↓
┌───────────────────────┐
│ 3. Merchant Frozen?    │ → NO → Continue
│    YES → FAIL          │
└───────────────────────┘
        ↓
┌───────────────────────┐
│ 4. Payout Wallet OK?  │ → YES → Continue
│    NO → FAIL           │
└───────────────────────┘
        ↓
┌───────────────────────┐
│ 5. Buyback Mint OK?   │ → YES → Continue
│    NO → FAIL           │
└───────────────────────┘
        ↓
┌───────────────────────┐
│ 6. BPS Bounds OK?     │ → YES → Continue
│    NO → FAIL           │
└───────────────────────┘
        ↓
┌───────────────────────┐
│ 7. Jupiter Router OK? │ → YES → Continue
│    NO → FAIL           │
└───────────────────────┘
        ↓
┌───────────────────────┐
│ 8. Slippage OK?       │ → YES → Execute
│    NO → FAIL           │
└───────────────────────┘
        ↓
   Payment Success
```

## Error Codes

All validation errors are defined in the smart contract:

```rust
#[error_code]
pub enum QantaraError {
    ProtocolPaused,
    InvalidMerchantId,
    MerchantFrozen,
    InvalidPayoutWallet,
    InvalidBuybackMint,
    InvalidBasisPoints,
    InvalidRouterProgram,
    SlippageExceeded,
    InvalidMinOut,
    // ... other errors
}
```

## Testing Validations

### Unit Tests

Each validation should be tested:

```rust
#[test]
fn test_protocol_pause() {
    // Test protocol pause validation
}

#[test]
fn test_merchant_id_validation() {
    // Test merchant ID validation
}

// ... etc
```

### Integration Tests

Test complete payment flow with all validations:

```typescript
describe('Payment Security Validations', () => {
  it('should fail when protocol is paused', async () => {
    // Test protocol pause
  });
  
  it('should fail with invalid merchant ID', async () => {
    // Test merchant ID validation
  });
  
  // ... etc
});
```

## Best Practices

### For Developers

1. **Always Validate:** Never skip validations
2. **Test All Cases:** Test both success and failure paths
3. **Handle Errors:** Implement proper error handling
4. **Monitor:** Log validation failures for analysis

### For Merchants

1. **Verify Configuration:** Ensure payout wallet and buyback mint are correct
2. **Monitor Status:** Check merchant status regularly
3. **Test First:** Always test on devnet

## Additional Resources

- [Security Overview](./overview.md) - General security information
- [Smart Contract Code](../../contracts/programs/qantara-v2/src/lib.rs) - Implementation
- [Error Definitions](../../contracts/programs/qantara-v2/src/errors.rs) - Error codes

