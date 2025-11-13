# Manual Foundation Testing Guide

## Prerequisites

1. **Start the API Server**
   ```bash
   cd apps/api-server
   npm install
   npm run dev
   ```

2. **Set Environment Variables**
   ```bash
   export RPC_URL=https://api.devnet.solana.com
   export DATABASE_URL=postgresql://user:pass@localhost:5432/qantara
   export IDL_PATH=../contracts/target/idl/qantara_v2.json
   ```

## Test 1: Health Check

```bash
curl http://localhost:3000/health
```

**Expected:** `200 OK` with health status

## Test 2: PDA Derivation (Programmatic)

Run the foundation tests:
```bash
npm run test:foundation
```

**Expected:** All PDA derivations should pass

## Test 3: IDL Loading

Check if IDL loads correctly:
```bash
node -e "
const { loadV2Idl } = require('./dist/services/program');
const idl = loadV2Idl();
console.log('IDL loaded:', idl.address);
console.log('Instructions:', idl.instructions.length);
"
```

**Expected:** IDL loads with correct program ID

## Test 4: Account Derivation

Test account derivation:
```bash
node -e "
const { deriveProtocolAccounts, getUsdcMint } = require('./dist/services/pda');
const usdcMint = getUsdcMint('devnet');
const accounts = deriveProtocolAccounts(usdcMint);
console.log('Protocol Config:', accounts.protocolConfigPDA.toBase58());
console.log('Vault SOL:', accounts.vaultSolPDA.toBase58());
console.log('Vault USDC:', accounts.vaultUsdcPDA.toBase58());
"
```

**Expected:** All PDAs derived correctly

## Test 5: Database Connection

Test database connection:
```bash
node -e "
const { pool } = require('./dist/services/database');
pool.query('SELECT NOW()').then(r => {
  console.log('Database connected:', r.rows[0]);
  process.exit(0);
}).catch(e => {
  console.error('Database error:', e.message);
  process.exit(1);
});
"
```

**Expected:** Database connection successful

## Test 6: Quote Endpoint (Without Buyback)

```bash
curl -X POST http://localhost:3000/v2/quote \
  -H "Content-Type: application/json" \
  -d '{
    "merchantOwner": "7xK...",
    "price": 100,
    "payToken": "USDC",
    "buybackBps": 0
  }'
```

**Expected:** Quote returned with `minOut: "0"` (no buyback)

## Test 7: Merchant Registration (Database Only)

```bash
curl -X POST http://localhost:3000/v2/merchants/register \
  -H "Content-Type: application/json" \
  -d '{
    "merchantOwner": "7xK...",
    "payoutWallet": "9xB...",
    "buybackMint": "PUMP_MINT"
  }'
```

**Expected:** Merchant created in database with merchant_id and PDAs

## Test 8: Get Merchant Info

```bash
curl http://localhost:3000/v2/merchants/{merchantId}
```

**Expected:** Merchant information returned

## Troubleshooting

### IDL Not Found
- Check `IDL_PATH` environment variable
- Ensure `contracts/target/idl/qantara_v2.json` exists
- Run `cd contracts && anchor build --program-name qantara-v2`

### Database Connection Failed
- Check `DATABASE_URL` environment variable
- Ensure PostgreSQL is running
- Run migration: `psql $DATABASE_URL -f ../../db/migrations/002_v2_merchant_schema.sql`

### Program ID Mismatch
- Verify `QANTARA_V2_PROGRAM_ID` in `src/services/pda.ts`
- Should be: `JCjXHcUy7LzJsLBoafjem9wRffRyuyGYsiTz35Yyr9AH`

