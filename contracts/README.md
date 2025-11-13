# Qantara Smart Contracts

Solana program for the Qantara payment protocol.

## Building

```bash
anchor build
```

## Testing

```bash
# Run all tests
anchor test

# Run specific test file
anchor test tests/qantara.spec.ts
```

## Deployment

### Devnet

```bash
anchor deploy --provider.cluster devnet
```

### Mainnet

```bash
anchor deploy --provider.cluster mainnet
```

## Program Structure

- `src/lib.rs` - Main program entry point
- `src/state.rs` - Account structures and contexts
- `src/errors.rs` - Custom error codes
- `src/utils.rs` - Helper functions (Jupiter CPI)

## Instructions

1. **init_merchant** - Initialize merchant configuration
2. **update_merchant** - Update merchant settings
3. **settle** - Execute payment (payout + buyback + burn)

