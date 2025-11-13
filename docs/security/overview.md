# Security Overview

Qantara Protocol implements comprehensive security measures to protect merchants, buyers, and the protocol itself.

## Security Philosophy

Qantara follows a **defense-in-depth** approach with multiple layers of security:

1. **On-Chain Validations** - Smart contract security checks
2. **Off-Chain Validation** - API-level validations
3. **Access Control** - Authority and permission checks
4. **Attack Prevention** - Specific protections against known attack vectors

## Security Validations

The protocol implements **8 comprehensive security validations** for every payment:

### 1. Protocol Pause Protection

**Purpose:** Emergency shutdown mechanism

**Implementation:**
```rust
require!(!protocol_config.paused, ProtocolPaused);
```

**Protection:** Prevents all operations when protocol is paused

**Use Cases:**
- Emergency response to vulnerabilities
- Protocol upgrades
- Critical bug fixes

### 2. Merchant ID Validation

**Purpose:** Ensures merchant exists and matches

**Implementation:**
```rust
require!(
    merchant.merchant_id == merchant_id,
    InvalidMerchantId
);
```

**Protection:** Prevents payments to non-existent merchants

### 3. Merchant Freeze Protection

**Purpose:** Per-merchant suspension

**Implementation:**
```rust
require!(!merchant.frozen, MerchantFrozen);
```

**Protection:** Prevents payments to frozen merchants

**Use Cases:**
- Suspicious activity
- Compliance issues
- Merchant request

### 4. Payout Wallet Validation

**Purpose:** Prevents rerouting attacks

**Implementation:**
```rust
require_keys_eq!(
    merchant_payout_wallet.key(),
    merchant.payout_wallet,
    InvalidPayoutWallet
);
```

**Protection:** Ensures payout goes to registered wallet

**Attack Prevented:** Rerouting attacks where attacker tries to redirect payments

### 5. Buyback Mint Validation

**Purpose:** Prevents wrong token attacks

**Implementation:**
```rust
require_keys_eq!(
    buyback_mint.key(),
    merchant.buyback_mint,
    InvalidBuybackMint
);
```

**Protection:** Ensures buyback uses correct token

**Attack Prevented:** Wrong token attacks where attacker tries to use different token

### 6. BPS Bounds Validation

**Purpose:** Prevents overflow and invalid splits

**Implementation:**
```rust
require!(
    payout_bps.checked_add(buyback_bps).unwrap_or(10001) <= 10000,
    InvalidBasisPoints
);
require!(
    burn_of_buyback_bps <= 10000,
    InvalidBasisPoints
);
```

**Protection:** Ensures percentages are valid

**Attack Prevented:** Overflow attacks and invalid percentage splits

### 7. Jupiter Router Allowlist

**Purpose:** Validates swap router

**Implementation:**
```rust
require_keys_eq!(
    jupiter_router.key(),
    protocol_config.jupiter_router,
    InvalidRouterProgram
);
```

**Protection:** Ensures swaps use approved router

**Attack Prevented:** Malicious router attacks

### 8. Slippage Protection

**Purpose:** Protects against unfavorable swaps

**Implementation:**
```rust
if buyback_bps > 0 {
    require!(min_out > 0, InvalidMinOut);
    require!(
        buyback_output >= min_out,
        SlippageExceeded
    );
}
```

**Protection:** Ensures minimum output from swaps

**Attack Prevented:** Slippage attacks and unfavorable swaps

## Attack Vectors and Protections

### Rerouting Attack

**Attack:** Attacker tries to redirect payment to their wallet

**Protection:** Payout wallet validation (Check #4)

**Result:** Transaction fails if payout wallet doesn't match registry

### Wrong Token Attack

**Attack:** Attacker tries to use different token for buyback

**Protection:** Buyback mint validation (Check #5)

**Result:** Transaction fails if buyback mint doesn't match registry

### Overflow Attack

**Attack:** Attacker tries to cause integer overflow

**Protection:** BPS bounds validation (Check #6) + checked arithmetic

**Result:** Transaction fails if percentages exceed bounds

### Slippage Attack

**Attack:** Attacker tries to exploit price movements

**Protection:** Slippage protection (Check #8)

**Result:** Transaction fails if output below minimum

### Malicious Router Attack

**Attack:** Attacker tries to use malicious swap router

**Protection:** Jupiter router allowlist (Check #7)

**Result:** Transaction fails if router doesn't match protocol config

### Reentrancy Attack

**Attack:** Attacker tries to re-enter function during execution

**Protection:** Solana's transaction model prevents reentrancy

**Result:** Not applicable (Solana architecture)

## Access Control

### Protocol Authority

**Who:** Protocol admin (multisig recommended)

**Permissions:**
- Initialize protocol
- Update protocol settings
- Pause/unpause protocol
- Update Jupiter router

**Security:** Single authority (can be upgraded to multisig)

### Merchant Owner

**Who:** Merchant wallet

**Permissions:**
- Register merchant
- Update merchant configuration
- Freeze/unfreeze merchant

**Security:** Owner-only operations

### Program Authority

**Who:** Program (PDA)

**Permissions:**
- Control vault accounts
- Execute burns
- Validate all operations

**Security:** Program-owned accounts

## Best Practices

### For Merchants

1. **Secure Wallet:** Use hardware wallet for merchant owner
2. **Monitor Activity:** Regularly check merchant status
3. **Verify Configuration:** Confirm payout wallet and buyback mint
4. **Test First:** Always test on devnet before mainnet

### For Developers

1. **Validate Inputs:** Always validate API inputs
2. **Handle Errors:** Implement proper error handling
3. **Check Status:** Verify merchant and protocol status
4. **Monitor Events:** Listen to on-chain events
5. **Test Security:** Test all security validations

### For Protocol Admins

1. **Multisig:** Use multisig for protocol authority
2. **Monitor:** Monitor protocol for suspicious activity
3. **Updates:** Keep protocol updated
4. **Documentation:** Document all changes

## Security Audits

### Current Status

- **Internal Review:** ✅ Completed
- **External Audit:** 🔄 Planned
- **Bug Bounty:** 🔄 Planned

### Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** open a public issue
2. Email: security@qantara.protocol (TBD)
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Security Roadmap

### Planned Improvements

- [ ] Multisig for protocol authority
- [ ] Rate limiting on API
- [ ] API authentication
- [ ] Enhanced monitoring
- [ ] Formal security audit
- [ ] Bug bounty program

## Additional Resources

- [Security Validations](./validations.md) - Detailed validation documentation
- [Architecture Overview](../architecture/overview.md) - System architecture
- [Payment Flow](../architecture/payment-flow.md) - Payment processing

## Disclaimer

While Qantara Protocol implements comprehensive security measures, no system is 100% secure. Always:

- Conduct your own security review
- Test thoroughly before production use
- Monitor for suspicious activity
- Keep software updated
- Follow best practices

