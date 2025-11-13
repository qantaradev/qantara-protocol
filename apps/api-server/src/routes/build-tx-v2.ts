import { Router } from 'express';
import { z } from 'zod';
import { Connection, PublicKey } from '@solana/web3.js';
import { buildSettleTransaction, getSettleAccounts } from '../services/transaction-builder';
import { getMerchantConfigById } from '../services/database';
import BNjs from 'bn.js';

const router = Router();

const buildTxRequestSchema = z.object({
  quoteId: z.string().uuid(),
  merchantId: z.string(),
  payer: z.string(),
  amount: z.string(),
  payToken: z.enum(['SOL', 'USDC']),
  minOut: z.string(),
  payoutBps: z.number().min(0).max(10000),
  buybackBps: z.number().min(0).max(10000),
  burnBps: z.number().min(0).max(10000),
  swapTransaction: z.string().optional(), // Base64 encoded Jupiter swap transaction
  priorityFee: z.number().optional(),
});

router.post('/', async (req, res) => {
  try {
    const body = buildTxRequestSchema.parse(req.body);
    
    const connection = new Connection(
      process.env.RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );

    // Get merchant config
    const merchant = await getMerchantConfigById(body.merchantId);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    if (merchant.frozen) {
      return res.status(403).json({ error: 'Merchant is frozen' });
    }

    // Validate BPS
    if (body.payoutBps + body.buybackBps > 10000) {
      return res.status(400).json({ 
        error: 'Invalid BPS: payout + buyback cannot exceed 10000' 
      });
    }

    // Get all required accounts
    const accounts = await getSettleAccounts(
      connection,
      merchant.merchant_id,
      new PublicKey(merchant.owner_pubkey),
      new PublicKey(merchant.payout_wallet),
      new PublicKey(merchant.buyback_mint),
      new PublicKey(merchant.vault_buyback_token)
    );

    // Build transaction
    const transaction = await buildSettleTransaction({
      connection,
      merchantId: merchant.merchant_id,
      payer: new PublicKey(body.payer),
      amount: body.amount,
      payToken: body.payToken,
      minOut: body.minOut,
      payoutBps: body.payoutBps,
      buybackBps: body.buybackBps,
      burnBps: body.burnBps,
      merchant: {
        merchantRegistryPDA: accounts.merchant.merchantRegistryPDA,
        payoutWallet: accounts.merchant.payoutWallet,
        buybackMint: accounts.merchant.buybackMint,
        vaultBuybackToken: accounts.merchant.vaultBuybackToken,
      },
      protocol: {
        protocolConfigPDA: accounts.protocol.protocolConfigPDA,
        vaultSolPDA: accounts.protocol.vaultSolPDA,
        vaultUsdcPDA: accounts.protocol.vaultUsdcPDA,
        protocolWallet: accounts.protocol.protocolWallet,
        jupiterRouter: accounts.protocol.jupiterRouter,
      },
      jupiterQuote: body.swapTransaction ? {
        quote: {}, // Quote data not needed for account extraction
        swapTransaction: body.swapTransaction,
      } : undefined,
      priorityFee: body.priorityFee,
    });

    // Serialize transaction
    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    res.json({
      transaction: Buffer.from(serialized).toString('base64'),
      expiresAt: Math.floor(Date.now() / 1000) + 30,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    console.error('Build tx error:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router as buildTxV2Router };

