# Qantara V2 - Setup & Testing Guide

## Overview

Qantara V2 is a scalable payment protocol with:
- **Hash-based merchant IDs** (privacy + security)
- **On-chain merchant registry** (prevents rerouting attacks)
- **Protocol fees** (1% default, configurable)
- **Full security validations** (all attacks prevented)

## Setup

### 1. Generate Program Keypair

In WSL terminal:

```bash
cd contracts
mkdir -p programs/qantara-v2/target/deploy
solana-keygen new --outfile programs/qantara-v2/target/deploy/qantara-v2-keypair.json --force
```

### 2. Update Program ID

Extract the program ID:

```bash
solana-keygen pubkey programs/qantara-v2/target/deploy/qantara-v2-keypair.json
```

Update `contracts/programs/qantara-v2/src/lib.rs`:

```rust
declare_id!("YOUR_PROGRAM_ID_HERE");
```

Update `contracts/Anchor.toml`:

```toml
[programs.devnet]
qantara_v2 = "YOUR_PROGRAM_ID_HERE"
```

### 3. Build Contract

```bash
cd contracts
anchor build
```

This will:
- Compile the V2 contract
- Generate IDL at `target/idl/qantara_v2.json`
- Create the `.so` binary

### 4. Run Tests

```bash
cd contracts
anchor test --skip-local-validator
```

Or run V2 tests specifically:

```bash
cd contracts
npm run test-v2
```

## Test Coverage

The V2 test suite (`tests/v2/qantara-v2.spec.ts`) covers:

### ✅ Security Tests
- **Rerouting Attack Prevention**: Wrong payout wallet rejected
- **Buyback Mint Validation**: Wrong mint rejected
- **BPS Validation**: Invalid basis points rejected
- **Protocol Pause**: Payments rejected when paused
- **Merchant Freeze**: Payments rejected when frozen

### ✅ Protocol Tests
- **Protocol Initialization**: Config setup
- **Merchant Registration**: On-chain registry creation
- **Fee Calculation**: Protocol fee enforcement

## Architecture

### On-Chain Accounts

1. **ProtocolConfig** (PDA: `["protocol"]`)
   - Protocol fee (1% = 100 bps)
   - Protocol wallet (fee recipient)
   - Jupiter router address
   - Pause status

2. **MerchantRegistry** (PDA: `["merchant", merchant_id]`)
   - Merchant ID (hash-based)
   - Owner (can update config)
   - Payout wallet (validated on-chain)
   - Buyback mint (validated on-chain)
   - Frozen status

### Security Features

1. **Rerouting Prevention**
   ```rust
   require_keys_eq!(
       merchant_payout_wallet,
       merchant_registry.payout_wallet,
       QantaraError::InvalidPayoutWallet
   );
   ```

2. **Protocol Fee Enforcement**
   ```rust
   // Fee calculated FIRST, transferred BEFORE any splits
   let protocol_fee = (amount * protocol_fee_bps) / 10000;
   transfer_protocol_fee(&ctx, protocol_fee, pay_token)?;
   ```

3. **Parameter Validation**
   ```rust
   require!(
       payout_bps + buyback_bps <= 10000,
       QantaraError::InvalidBasisPoints
   );
   ```

## Deployment

### Devnet

```bash
anchor build
anchor deploy --provider.cluster devnet
```

### Mainnet

```bash
anchor build --release
anchor deploy --provider.cluster mainnet
```

## Next Steps

1. ✅ Contract implemented
2. ✅ Tests created
3. ⏳ Build and test
4. ⏳ Update database schema
5. ⏳ Update API server
6. ⏳ Integration testing

## Troubleshooting

### Build Errors

**Error: "String is the wrong size"**
- Solution: Update `declare_id!()` in `lib.rs` with correct program ID

**Error: "IDL not found"**
- Solution: Run `anchor build` first to generate IDL

### Test Errors

**Error: "ANCHOR_PROVIDER_URL not set"**
- Solution: Set in WSL: `export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com`

**Error: "Insufficient funds"**
- Solution: Airdrop SOL: `solana airdrop 2 <wallet> --url devnet`

## Security Audit Checklist

- [x] Rerouting attack prevention
- [x] Parameter manipulation prevention
- [x] Protocol fee enforcement
- [x] Slippage protection
- [x] Frozen merchant checks
- [x] Jupiter router allowlist
- [ ] External security audit (pending)

