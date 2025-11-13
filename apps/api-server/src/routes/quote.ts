import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { PublicKey } from '@solana/web3.js';
import { getJupiterQuote } from '../services/jupiter';
import { getMerchantConfig } from '../services/database';

const router = Router();

const quoteRequestSchema = z.object({
  merchantOwner: z.string(),
  amount: z.string().or(z.number()),
  payToken: z.enum(['SOL', 'USDC']),
});

router.post('/', async (req, res) => {
  try {
    const body = quoteRequestSchema.parse(req.body);
    
    // Get merchant config
    const merchant = await getMerchantConfig(body.merchantOwner);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    if (merchant.frozen) {
      return res.status(403).json({ error: 'Merchant is frozen' });
    }

    // Validate payment token
    if (body.payToken === 'SOL' && !merchant.allow_sol) {
      return res.status(400).json({ error: 'SOL payments not allowed' });
    }
    if (body.payToken === 'USDC' && !merchant.allow_usdc) {
      return res.status(400).json({ error: 'USDC payments not allowed' });
    }

    const amount = BigInt(body.amount.toString());
    const buybackAmount = (amount * BigInt(merchant.buyback_bps)) / BigInt(10000);

    if (buybackAmount === 0n) {
      // No buyback, return quote with min_out = 0
      return res.json({
        quoteId: randomUUID(),
        inputMint: body.payToken === 'SOL' 
          ? 'So11111111111111111111111111111111111111112' 
          : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        outputMint: merchant.buyback_mint,
        inAmount: buybackAmount.toString(),
        minOut: '0',
        slippageBps: merchant.slippage_bps_max,
        routeAccounts: [],
        expiresAt: Math.floor(Date.now() / 1000) + 30, // 30 seconds
      });
    }

    // Get Jupiter quote
    const inputMint = body.payToken === 'SOL'
      ? 'So11111111111111111111111111111111111111112'
      : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC devnet

    const quote = await getJupiterQuote(
      inputMint,
      merchant.buyback_mint,
      buybackAmount.toString(),
      merchant.slippage_bps_max
    );

    if (!quote) {
      return res.status(500).json({ error: 'Failed to get quote from Jupiter' });
    }

    // Calculate min_out with slippage
    const minOut = BigInt(quote.outAmount) * BigInt(10000 - merchant.slippage_bps_max) / BigInt(10000);

    res.json({
      quoteId: randomUUID(),
      inputMint,
      outputMint: merchant.buyback_mint,
      inAmount: buybackAmount.toString(),
      minOut: minOut.toString(),
      slippageBps: merchant.slippage_bps_max,
      routeAccounts: quote.routeAccounts || [],
      expiresAt: Math.floor(Date.now() / 1000) + 30, // 30 seconds
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    console.error('Quote error:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router as quoteRouter };

