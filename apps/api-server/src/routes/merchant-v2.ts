import { Router } from 'express';
import { z } from 'zod';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  createAccount, 
  setAuthority, 
  AuthorityType,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { createHash } from 'crypto';
import BNjs from 'bn.js';
import { getProgram, createProgramWithProvider } from '../services/program';
import { 
  deriveMerchantRegistryPDA, 
  deriveProtocolConfigPDA,
  getUsdcMint,
} from '../services/pda';
import { createMerchant, getMerchantConfig, getMerchantConfigById } from '../services/database';

const router = Router();

const registerRequestSchema = z.object({
  merchantOwner: z.string(), // Merchant's wallet (signer)
  payoutWallet: z.string(), // Where payments go (MERCHANT CONTROLS)
  buybackMint: z.string(), // Community token mint (MERCHANT PROVIDES)
  defaultPayoutBps: z.number().min(0).max(10000).optional(),
  defaultBuybackBps: z.number().min(0).max(10000).optional(),
  defaultBurnBps: z.number().min(0).max(10000).optional(),
  slippageBps: z.number().min(0).max(10000).optional(),
  allowSol: z.boolean().optional(),
  allowUsdc: z.boolean().optional(),
  webhookUrl: z.string().url().optional(),
});

/**
 * Generate merchant ID (hash-based)
 */
function generateMerchantId(merchantOwner: string): string {
  const hash = createHash('sha256')
    .update(
      Buffer.from(
        merchantOwner +
        Date.now().toString() +
        Math.random().toString()
      )
    )
    .digest();
  
  // Take first 8 bytes and convert to u64
  const merchantIdBN = new BNjs(hash.slice(0, 8), 'le');
  return merchantIdBN.toString();
}

router.post('/register', async (req, res) => {
  try {
    const body = registerRequestSchema.parse(req.body);

    // Validate BPS
    const payoutBps = body.defaultPayoutBps ?? 7000;
    const buybackBps = body.defaultBuybackBps ?? 3000;
    
    if (payoutBps + buybackBps > 10000) {
      return res.status(400).json({ 
        error: 'Invalid BPS: payout + buyback cannot exceed 10000' 
      });
    }

    // Check if merchant already exists
    const existingMerchant = await getMerchantConfig(body.merchantOwner);
    if (existingMerchant) {
      return res.status(409).json({ 
        error: 'Merchant already registered',
        merchantId: existingMerchant.merchant_id,
      });
    }

    const connection = new Connection(
      process.env.RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );

    const merchantOwnerPubkey = new PublicKey(body.merchantOwner);
    const payoutWalletPubkey = new PublicKey(body.payoutWallet);
    const buybackMintPubkey = new PublicKey(body.buybackMint);

    // Generate merchant ID
    const merchantId = generateMerchantId(body.merchantOwner);

    // Derive merchant registry PDA
    const [merchantRegistryPDA] = deriveMerchantRegistryPDA(merchantId);

    // Get program
    const program = getProgram(connection);

    // Check if merchant is already registered on-chain
    try {
      const existingRegistry = await program.account.merchantRegistry.fetch(merchantRegistryPDA);
      if (existingRegistry) {
        return res.status(409).json({ 
          error: 'Merchant already registered on-chain',
          merchantId: merchantId,
          merchantRegistryPDA: merchantRegistryPDA.toBase58(),
        });
      }
    } catch (e) {
      // Account doesn't exist, continue with registration
    }

    // Create vault buyback token account
    // Note: In production, this should use the merchant owner's wallet as signer
    // For now, we'll require the merchant to create it themselves or use a service wallet
    const serviceWallet = process.env.SERVICE_WALLET_PRIVATE_KEY
      ? Keypair.fromSecretKey(Buffer.from(process.env.SERVICE_WALLET_PRIVATE_KEY, 'base64'))
      : null;

    if (!serviceWallet) {
      return res.status(500).json({ 
        error: 'Service wallet not configured. Cannot create vault buyback token account.' 
      });
    }

    // Create token account for buyback mint
    const vaultBuybackToken = await createAccount(
      connection,
      serviceWallet,
      buybackMintPubkey,
      merchantOwnerPubkey // Initial owner
    );

    // Set authority to merchant registry PDA (for burning)
    await setAuthority(
      connection,
      serviceWallet,
      vaultBuybackToken,
      merchantOwnerPubkey,
      AuthorityType.AccountOwner,
      merchantRegistryPDA
    );

    // Register merchant on-chain
    // Note: This requires the merchant owner to sign
    // For now, we'll return the instruction details and let the frontend handle signing
    // Or use a service wallet if merchant owner delegates authority

    // Store merchant in database
    const merchant = await createMerchant({
      merchant_id: merchantId,
      owner_pubkey: body.merchantOwner,
      merchant_registry_pda: merchantRegistryPDA.toBase58(),
      payout_wallet: body.payoutWallet,
      buyback_mint: body.buybackMint,
      vault_buyback_token: vaultBuybackToken.toBase58(),
      default_payout_bps: payoutBps,
      default_buyback_bps: buybackBps,
      default_burn_bps: body.defaultBurnBps ?? 5000,
      slippage_bps: body.slippageBps ?? 100,
      allow_sol: body.allowSol ?? true,
      allow_usdc: body.allowUsdc ?? true,
      webhook_url: body.webhookUrl,
    });

    res.json({
      merchantId: merchant.merchant_id,
      merchantRegistryPDA: merchant.merchant_registry_pda,
      vaultBuybackToken: merchant.vault_buyback_token,
      status: 'registered',
      // Note: Merchant still needs to call register_merchant on-chain
      // This can be done via a separate endpoint or frontend
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    console.error('Register merchant error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;

    const merchant = await getMerchantConfigById(merchantId);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    res.json({
      merchantId: merchant.merchant_id,
      merchantOwner: merchant.owner_pubkey,
      merchantRegistryPDA: merchant.merchant_registry_pda,
      payoutWallet: merchant.payout_wallet,
      buybackMint: merchant.buyback_mint,
      vaultBuybackToken: merchant.vault_buyback_token,
      defaultPayoutBps: merchant.default_payout_bps,
      defaultBuybackBps: merchant.default_buyback_bps,
      defaultBurnBps: merchant.default_burn_bps,
      slippageBps: merchant.slippage_bps,
      allowSol: merchant.allow_sol,
      allowUsdc: merchant.allow_usdc,
      frozen: merchant.frozen,
      createdAt: merchant.created_at,
      updatedAt: merchant.updated_at,
    });
  } catch (error: any) {
    console.error('Get merchant error:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router as merchantV2Router };

