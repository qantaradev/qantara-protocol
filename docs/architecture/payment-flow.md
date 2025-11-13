# Payment Flow

This document describes the detailed payment flow in Qantara Protocol, from quote request to on-chain settlement.

## Overview

A Qantara payment executes three atomic actions in a single transaction:

1. **Merchant Payout** - Direct transfer to merchant wallet
2. **Token Buyback** - Automatic swap via Jupiter aggregator
3. **Protocol-Enforced Burn** - Deflationary tokenomics support

## Payment Flow Diagram

```
┌──────────┐
│  Buyer   │
└────┬─────┘
     │ 1. Initiate Payment
     ▼
┌─────────────────┐
│  Merchant App   │
└────┬────────────┘
     │ 2. Request Quote
     ▼
┌─────────────────┐
│   API Server    │
│  - Get Merchant │
│  - Get Jupiter  │
│    Quote        │
└────┬────────────┘
     │ 3. Return Quote
     ▼
┌─────────────────┐
│  Merchant App   │
└────┬────────────┘
     │ 4. Build Transaction
     ▼
┌─────────────────┐
│   API Server    │
│  - Build Settle │
│    Instruction  │
│  - Add Jupiter  │
│    Swap         │
└────┬────────────┘
     │ 5. Return Transaction
     ▼
┌─────────────────┐
│  Buyer Wallet    │
│  - Sign          │
│  - Send          │
└────┬────────────┘
     │ 6. Submit Transaction
     ▼
┌─────────────────┐
│  Solana Network │
└────┬────────────┘
     │ 7. Execute
     ▼
┌─────────────────┐
│  Qantara Program│
│  - Validate     │
│  - Split Payment│
│  - Execute Swap │
│  - Burn Tokens  │
└─────────────────┘
```

## Step-by-Step Flow

### Step 1: Quote Request

**Actor:** Merchant Application

**Action:** Request payment quote from API

**Request:**
```json
POST /v2/quote
{
  "merchantId": "12345678901234567890",
  "price": 100,
  "payToken": "USDC",
  "payoutBps": 7000,
  "buybackBps": 3000,
  "burnBps": 5000
}
```

**API Processing:**
1. Validate merchant exists and is not frozen
2. Calculate payment amount (price × decimals)
3. Calculate buyback amount (amount × buybackBps / 10000)
4. Request Jupiter quote for swap
5. Calculate minimum output with slippage
6. Generate quote ID and expiration

**Response:**
```json
{
  "quoteId": "uuid",
  "merchantId": "12345678901234567890",
  "amount": "100000000",
  "payToken": "USDC",
  "payoutBps": 7000,
  "buybackBps": 3000,
  "burnBps": 5000,
  "buybackAmount": "30000000",
  "minOut": "1500000000",
  "estimatedTokens": "1515151515",
  "swapTransaction": "base64...",
  "expiresAt": 1234567890
}
```

### Step 2: Transaction Building

**Actor:** Merchant Application

**Action:** Request transaction build

**Request:**
```json
POST /v2/build-tx
{
  "quoteId": "uuid",
  "merchantId": "12345678901234567890",
  "payer": "BUYER_WALLET",
  "amount": "100000000",
  "payToken": "USDC",
  "minOut": "1500000000",
  "payoutBps": 7000,
  "buybackBps": 3000,
  "burnBps": 5000,
  "swapTransaction": "base64..."
}
```

**API Processing:**
1. Validate quote is not expired
2. Get merchant configuration
3. Derive all required PDAs
4. Build settle instruction
5. Add Jupiter swap instructions
6. Add priority fee (if specified)
7. Serialize transaction

**Response:**
```json
{
  "transaction": "base64_serialized_transaction",
  "expiresAt": 1234567890
}
```

### Step 3: Transaction Signing

**Actor:** Buyer

**Action:** Sign transaction with wallet

**Process:**
```typescript
const transaction = VersionedTransaction.deserialize(
  Buffer.from(response.transaction, 'base64')
);

// Sign with buyer's wallet
transaction.sign([buyerKeypair]);

// Or with wallet adapter
const signed = await wallet.signTransaction(transaction);
```

### Step 4: Transaction Submission

**Actor:** Buyer/Merchant Application

**Action:** Submit to Solana network

**Process:**
```typescript
const signature = await connection.sendTransaction(signed);
await connection.confirmTransaction(signature);
```

### Step 5: On-Chain Execution

**Actor:** Qantara Smart Contract

**Action:** Execute settle instruction

#### Security Validations

The contract performs 8 security checks:

1. **Protocol Pause Check**
   ```rust
   require!(!protocol_config.paused, ProtocolPaused);
   ```

2. **Merchant ID Validation**
   ```rust
   require!(
       merchant.merchant_id == merchant_id,
       InvalidMerchantId
   );
   ```

3. **Merchant Freeze Check**
   ```rust
   require!(!merchant.frozen, MerchantFrozen);
   ```

4. **Payout Wallet Validation**
   ```rust
   require_keys_eq!(
       merchant_payout_wallet.key(),
       merchant.payout_wallet,
       InvalidPayoutWallet
   );
   ```

5. **Buyback Mint Validation**
   ```rust
   require_keys_eq!(
       buyback_mint.key(),
       merchant.buyback_mint,
       InvalidBuybackMint
   );
   ```

6. **BPS Bounds Validation**
   ```rust
   require!(
       payout_bps + buyback_bps <= 10000,
       InvalidBasisPoints
   );
   ```

7. **Jupiter Router Validation**
   ```rust
   require_keys_eq!(
       jupiter_router.key(),
       protocol_config.jupiter_router,
       InvalidRouterProgram
   );
   ```

8. **Slippage Protection**
   ```rust
   if buyback_bps > 0 {
       require!(min_out > 0, InvalidMinOut);
       require!(buyback_output >= min_out, SlippageExceeded);
   }
   ```

#### Payment Processing

After validations pass, the contract executes:

1. **Receive Payment**
   - SOL: Transfer from buyer to vault_sol
   - USDC: Transfer from buyer USDC account to vault_usdc

2. **Calculate Protocol Fee**
   ```rust
   protocol_fee = (amount * protocol_fee_bps) / 10000
   ```

3. **Transfer Protocol Fee**
   - Deduct from vault
   - Transfer to protocol wallet

4. **Calculate Splits**
   ```rust
   remaining = amount - protocol_fee
   merchant_payout = (remaining * payout_bps) / 10000
   buyback_amount = (remaining * buyback_bps) / 10000
   ```

5. **Execute Buyback Swap**
   - If USDC payment: USDC → SOL → buyback_token
   - If SOL payment: SOL → buyback_token
   - Swap executed via Jupiter router
   - Tokens received in vault_buyback_token

6. **Burn Tokens**
   ```rust
   burn_amount = (buyback_output * burn_bps) / 10000
   token::burn(burn_amount)
   ```

7. **Transfer Merchant Payout**
   - Deduct from vault
   - Transfer to merchant payout wallet

8. **Emit Event**
   ```rust
   emit!(PaymentSettled {
       merchant_id,
       payer,
       amount,
       pay_token,
       protocol_fee,
       payout_amount,
       buyback_amount,
       burn_amount,
       timestamp,
   });
   ```

## Payment Flow Examples

### SOL Payment Flow

```
1. Buyer sends 1 SOL
   ↓
2. Vault SOL receives 1 SOL
   ↓
3. Protocol fee deducted (e.g., 0.01 SOL)
   ↓
4. Remaining: 0.99 SOL
   ↓
5. Split:
   - Merchant: 0.693 SOL (70%)
   - Buyback: 0.297 SOL (30%)
   ↓
6. Swap: 0.297 SOL → Buyback Tokens
   ↓
7. Burn: 50% of buyback tokens
   ↓
8. Transfer: 0.693 SOL to merchant
```

### USDC Payment Flow

```
1. Buyer sends 100 USDC
   ↓
2. Vault USDC receives 100 USDC
   ↓
3. Protocol fee deducted (e.g., 1 USDC)
   ↓
4. Remaining: 99 USDC
   ↓
5. Split:
   - Merchant: 69.3 USDC (70%)
   - Buyback: 29.7 USDC (30%)
   ↓
6. Swap 1: 29.7 USDC → SOL
   ↓
7. Swap 2: SOL → Buyback Tokens
   ↓
8. Burn: 50% of buyback tokens
   ↓
9. Transfer: 69.3 USDC to merchant
```

## Transaction Structure

### Settle Instruction Accounts

```rust
pub struct Settle<'info> {
    pub protocol_config: Account<'info, ProtocolConfig>,
    pub merchant_registry: Account<'info, MerchantRegistry>,
    pub payer: Signer<'info>,
    pub vault_sol: AccountInfo<'info>,
    pub vault_usdc: Account<'info, TokenAccount>,
    pub vault_buyback_token: Account<'info, TokenAccount>,
    pub buyback_mint: Account<'info, Mint>,
    pub protocol_wallet: AccountInfo<'info>,
    pub protocol_wallet_usdc: Account<'info, TokenAccount>,
    pub merchant_payout_wallet: AccountInfo<'info>,
    pub merchant_payout_usdc: Account<'info, TokenAccount>,
    pub payer_usdc_account: Account<'info, TokenAccount>,
    pub jupiter_router: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    // Remaining accounts: Jupiter swap route accounts
}
```

### Instruction Data

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

## Error Handling

### Common Errors

- **ProtocolPaused** - Protocol is paused
- **InvalidMerchantId** - Merchant doesn't exist
- **MerchantFrozen** - Merchant is frozen
- **InvalidPayoutWallet** - Payout wallet mismatch
- **InvalidBuybackMint** - Buyback mint mismatch
- **InvalidBasisPoints** - BPS exceeds 10000
- **InvalidRouterProgram** - Jupiter router mismatch
- **SlippageExceeded** - Swap output below minimum

### Error Recovery

- **Quote Expired:** Request new quote
- **Slippage Exceeded:** Increase slippage tolerance or retry
- **Insufficient Balance:** Ensure buyer has enough funds
- **Transaction Failed:** Check error message and retry

## Performance Considerations

### Transaction Size

- Base transaction: ~1.5 KB
- With Jupiter swap: ~5-10 KB
- Maximum: 1232 bytes per transaction (Solana limit)

### Compute Units

- Base settle: ~50,000 CU
- With swap: ~200,000-300,000 CU
- Priority fee recommended for faster confirmation

### Confirmation Time

- Target: 400ms (Solana block time)
- With priority fee: ~1-2 seconds
- Without priority fee: ~5-10 seconds

## Next Steps

- [Architecture Overview](./overview.md) - System architecture
- [Vault Architecture](./vault-architecture.md) - Vault design
- [API Documentation](../api/overview.md) - API reference
- [Security Guide](../security/overview.md) - Security details

