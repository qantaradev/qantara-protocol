import { Router } from 'express';
import { z } from 'zod';
import { 
  Connection, 
  PublicKey, 
  Transaction,
  VersionedTransaction,
  SystemProgram,
} from '@solana/web3.js';
import { buildSettleTransaction } from '../services/transaction-builder';
import { getMerchantConfig } from '../services/database';

const router = Router();

const buildTxRequestSchema = z.object({
  quoteId: z.string().uuid(),
  merchantOwner: z.string(),
  payer: z.string(),
  amount: z.string().or(z.number()),
  payToken: z.enum(['SOL', 'USDC']),
  minOut: z.string().or(z.number()),
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
    const merchant = await getMerchantConfig(body.merchantOwner);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    // Build transaction
    const transaction = await buildSettleTransaction(
      connection,
      new PublicKey(body.merchantOwner),
      new PublicKey(body.payer),
      BigInt(body.amount.toString()),
      body.payToken,
      BigInt(body.minOut.toString()),
      merchant
    );

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

export { router as buildTxRouter };

