import { Pool, PoolConfig } from 'pg';

/**
 * Database connection configuration
 * 
 * Supports:
 * - PostgreSQL (standard connection string)
 * - Supabase (PostgreSQL-compatible, use connection string from Supabase dashboard)
 * - Any PostgreSQL-compatible database
 * 
 * Connection string format:
 * - PostgreSQL: postgresql://user:password@host:port/database
 * - Supabase: postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres
 */
function getPoolConfig(): PoolConfig {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Supabase uses PostgreSQL, so standard pg Pool works
  // Additional configuration can be added here if needed
  const config: PoolConfig = {
    connectionString,
    // Connection pool settings
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '2000', 10),
  };

  // SSL configuration (required for Supabase and most cloud providers)
  if (process.env.DB_SSL === 'true' || connectionString.includes('supabase.co')) {
    config.ssl = {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    };
  }

  return config;
}

const pool = new Pool(getPoolConfig());

export interface MerchantConfig {
  id: number;
  merchant_id: string; // u64 as string
  owner_pubkey: string; // Merchant owner wallet
  merchant_registry_pda: string; // Merchant registry PDA address
  payout_wallet: string; // Where payments go (MERCHANT CONTROLS)
  buyback_mint: string; // Community token mint (MERCHANT PROVIDES)
  vault_buyback_token: string; // Buyback token account (PROTOCOL CREATES)
  default_payout_bps: number; // Default payout % (MERCHANT CONTROLS)
  default_buyback_bps: number; // Default buyback % (MERCHANT CONTROLS)
  default_burn_bps: number; // Default burn % of buyback (MERCHANT CONTROLS)
  slippage_bps: number; // Slippage tolerance (default: 100 = 1%)
  allow_sol: boolean; // Allow SOL payments (MERCHANT CONTROLS)
  allow_usdc: boolean; // Allow USDC payments (MERCHANT CONTROLS)
  frozen: boolean; // From on-chain registry
  webhook_url?: string;
  created_at: Date;
  updated_at: Date;
}

export async function getMerchantConfig(ownerPubkey: string): Promise<MerchantConfig | null> {
  const result = await pool.query(
    'SELECT * FROM merchants WHERE owner_pubkey = $1',
    [ownerPubkey]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as MerchantConfig;
}

export async function getMerchantConfigById(merchantId: string): Promise<MerchantConfig | null> {
  const result = await pool.query(
    'SELECT * FROM merchants WHERE merchant_id = $1',
    [merchantId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0] as MerchantConfig;
}

export async function createMerchant(merchant: {
  merchant_id: string;
  owner_pubkey: string;
  merchant_registry_pda: string;
  payout_wallet: string;
  buyback_mint: string;
  vault_buyback_token: string;
  default_payout_bps?: number;
  default_buyback_bps?: number;
  default_burn_bps?: number;
  slippage_bps?: number;
  allow_sol?: boolean;
  allow_usdc?: boolean;
  webhook_url?: string;
}): Promise<MerchantConfig> {
  const result = await pool.query(
    `INSERT INTO merchants (
      merchant_id, owner_pubkey, merchant_registry_pda, payout_wallet,
      buyback_mint, vault_buyback_token,
      default_payout_bps, default_buyback_bps, default_burn_bps,
      slippage_bps, allow_sol, allow_usdc, webhook_url
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      merchant.merchant_id,
      merchant.owner_pubkey,
      merchant.merchant_registry_pda,
      merchant.payout_wallet,
      merchant.buyback_mint,
      merchant.vault_buyback_token,
      merchant.default_payout_bps ?? 7000,
      merchant.default_buyback_bps ?? 3000,
      merchant.default_burn_bps ?? 5000,
      merchant.slippage_bps ?? 100,
      merchant.allow_sol ?? true,
      merchant.allow_usdc ?? true,
      merchant.webhook_url || null,
    ]
  );

  return result.rows[0] as MerchantConfig;
}

export async function insertPayment(payment: {
  merchant_owner: string;
  payer: string;
  amount_in: string;
  pay_token: 'SOL' | 'USDC';
  payout_amount?: string;
  buyback_amount?: string;
  burn_amount?: string;
  transaction_signature: string;
  slot: number;
  block_time?: Date;
  status: 'confirmed' | 'finalized' | 'failed';
  error_message?: string;
}): Promise<number> {
  const result = await pool.query(
    `INSERT INTO payments (
      merchant_owner, payer, amount_in, pay_token,
      payout_amount, buyback_amount, burn_amount,
      transaction_signature, slot, block_time, status, error_message
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id`,
    [
      payment.merchant_owner,
      payment.payer,
      payment.amount_in,
      payment.pay_token,
      payment.payout_amount || null,
      payment.buyback_amount || null,
      payment.burn_amount || null,
      payment.transaction_signature,
      payment.slot,
      payment.block_time || new Date(),
      payment.status,
      payment.error_message || null,
    ]
  );

  return result.rows[0].id;
}

export { pool };

