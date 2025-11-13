# Smart Contract Development

Guide for developing and contributing to Qantara Protocol smart contracts.

## Project Structure

```
contracts/
├── programs/
│   ├── qantara/          # Legacy V1 (deprecated)
│   └── qantara-v2/       # Current V2 program
│       └── src/
│           ├── lib.rs     # Main program logic
│           ├── state.rs   # Account structures
│           ├── errors.rs   # Error definitions
│           └── utils.rs    # Utility functions
├── tests/                 # Integration tests
├── scripts/               # Deployment scripts
└── Anchor.toml            # Anchor configuration
```

## Development Setup

### Prerequisites

- Rust 1.70+
- Anchor 0.29+
- Solana CLI 1.18+

### Build

```bash
cd contracts
anchor build
```

### Test

```bash
anchor test
```

### Deploy

```bash
anchor deploy
```

## Program Architecture

### Main Program

**File:** `programs/qantara-v2/src/lib.rs`

**Program ID:** `JCjXHcUy7LzJsLBoafjem9wRffRyuyGYsiTz35Yyr9AH`

### Instructions

#### 1. Init Protocol

Initialize protocol configuration (admin only).

```rust
pub fn init_protocol(
    ctx: Context<InitProtocol>,
    protocol_fee_bps: u16,
    protocol_wallet: Pubkey,
    jupiter_router: Pubkey,
) -> Result<()>
```

**Accounts:**
- `protocol_config` - Protocol config PDA (init)
- `authority` - Protocol admin (signer)

**Constraints:**
- `protocol_fee_bps <= 500` (max 5%)

#### 2. Update Protocol

Update protocol settings (admin only).

```rust
pub fn update_protocol(
    ctx: Context<UpdateProtocol>,
    protocol_fee_bps: Option<u16>,
    protocol_wallet: Option<Pubkey>,
    jupiter_router: Option<Pubkey>,
    paused: Option<bool>,
) -> Result<()>
```

**Accounts:**
- `protocol_config` - Protocol config PDA (mut)
- `authority` - Protocol admin (signer)

#### 3. Register Merchant

Register a new merchant.

```rust
pub fn register_merchant(
    ctx: Context<RegisterMerchant>,
    merchant_id: u64,
    payout_wallet: Pubkey,
    buyback_mint: Pubkey,
) -> Result<()>
```

**Accounts:**
- `merchant_registry` - Merchant registry PDA (init)
- `owner` - Merchant owner (signer)

#### 4. Update Merchant

Update merchant configuration (owner only).

```rust
pub fn update_merchant(
    ctx: Context<UpdateMerchant>,
    payout_wallet: Option<Pubkey>,
    buyback_mint: Option<Pubkey>,
    frozen: Option<bool>,
) -> Result<()>
```

**Accounts:**
- `merchant_registry` - Merchant registry PDA (mut)
- `owner` - Merchant owner (signer)

#### 5. Settle

Execute payment settlement.

```rust
pub fn settle(
    ctx: Context<Settle>,
    merchant_id: u64,
    amount: u64,
    pay_token: PayToken,
    min_out: u64,
    payout_bps: u16,
    buyback_bps: u16,
    burn_of_buyback_bps: u16,
) -> Result<()>
```

**Accounts:**
- `protocol_config` - Protocol config
- `merchant_registry` - Merchant registry
- `payer` - Buyer (signer)
- `vault_sol` - SOL vault
- `vault_usdc` - USDC vault
- `vault_buyback_token` - Buyback token vault
- `buyback_mint` - Buyback token mint
- `protocol_wallet` - Protocol fee recipient
- `merchant_payout_wallet` - Merchant payout destination
- `jupiter_router` - Jupiter router program
- `token_program` - SPL Token program
- `system_program` - System program
- Remaining accounts: Jupiter swap accounts

## Account Structures

### ProtocolConfig

```rust
#[account]
pub struct ProtocolConfig {
    pub authority: Pubkey,
    pub protocol_fee_bps: u16,
    pub protocol_wallet: Pubkey,
    pub jupiter_router: Pubkey,
    pub paused: bool,
    pub bump: u8,
}
```

**PDA Seeds:** `[b"protocol"]`

### MerchantRegistry

```rust
#[account]
pub struct MerchantRegistry {
    pub merchant_id: u64,
    pub owner: Pubkey,
    pub payout_wallet: Pubkey,
    pub buyback_mint: Pubkey,
    pub frozen: bool,
    pub bump: u8,
}
```

**PDA Seeds:** `[b"merchant", merchant_id.to_le_bytes()]`

## Error Handling

### Error Definitions

**File:** `programs/qantara-v2/src/errors.rs`

```rust
#[error_code]
pub enum QantaraError {
    ProtocolFeeTooHigh,
    ProtocolPaused,
    InvalidMerchantId,
    MerchantFrozen,
    InvalidPayoutWallet,
    InvalidBuybackMint,
    InvalidBasisPoints,
    SlippageTooHigh,
    PayTokenNotAllowed,
    InvalidRouterProgram,
    SlippageExceeded,
    InvalidMinOut,
    Unauthorized,
}
```

### Error Usage

```rust
require!(
    !protocol_config.paused,
    QantaraError::ProtocolPaused
);
```

## Testing

### Unit Tests

Test individual functions:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_protocol_init() {
        // Test protocol initialization
    }
}
```

### Integration Tests

**File:** `tests/v2/qantara-v2.spec.ts`

```typescript
describe("Qantara V2", () => {
  it("Initializes protocol", async () => {
    // Test protocol initialization
  });

  it("Registers merchant", async () => {
    // Test merchant registration
  });

  it("Processes payment", async () => {
    // Test payment settlement
  });
});
```

## Best Practices

### Security

1. **Always Validate:** Check all inputs
2. **Use Checked Math:** Prevent overflow
3. **Validate Accounts:** Check account keys
4. **Test Edge Cases:** Test boundary conditions

### Code Quality

1. **Follow Rust Conventions:** Use standard Rust style
2. **Document Code:** Add comments for complex logic
3. **Error Messages:** Provide clear error messages
4. **Test Coverage:** Aim for high test coverage

### Performance

1. **Minimize Compute:** Optimize compute units
2. **Efficient Storage:** Use appropriate data types
3. **Batch Operations:** Group related operations

## Deployment

### Devnet

```bash
anchor build
anchor deploy --provider.cluster devnet
```

### Mainnet

```bash
anchor build
anchor deploy --provider.cluster mainnet
```

**Warning:** Mainnet deployment requires careful review and testing.

## Upgrading

### Program Upgrade

1. Build new program
2. Deploy to same program ID
3. Verify upgrade authority
4. Test thoroughly

### State Migration

If account structures change:
1. Create migration instruction
2. Execute migration
3. Verify state

## Contributing

### Code Style

- Follow Rust formatting: `cargo fmt`
- Run linter: `cargo clippy`
- Follow Anchor conventions

### Pull Requests

1. Create feature branch
2. Write tests
3. Update documentation
4. Submit PR with description

## Resources

- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Program Library](https://spl.solana.com/)
- [Rust Documentation](https://doc.rust-lang.org/)

