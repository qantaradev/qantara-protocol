import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { Connection, PublicKey } from '@solana/web3.js';
import { getJupiterQuote, getMultiHopQuote, getJupiterSwapTransaction, SOL_MINT } from '../services/jupiter';
import { getMerchantConfig, getMerchantConfigById } from '../services/database';
import { getUsdcMint } from '../services/pda';

const router = Router();

const quoteRequestSchema = z.object({
  merchantOwner: z.string().optional(),
  merchantId: z.string().optional(),
  price: z.number().positive(), // Price in USDC or SOL (e.g., 100 for $100)
  payToken: z.enum(['SOL', 'USDC']),
  payoutBps: z.number().min(0).max(10000).optional(),
  buybackBps: z.number().min(0).max(10000).optional(),
  burnBps: z.number().min(0).max(10000).optional(),
});

/**
 * Convert price to amount based on token decimals
 */
function priceToAmount(price: number, payToken: 'SOL' | 'USDC'): string {
  if (payToken === 'SOL') {
    // SOL has 9 decimals
    // price is in SOL (e.g., 1.5 SOL)
    return Math.floor(price * 1e9).toString();
  } else {
    // USDC has 6 decimals
    // price is in USDC (e.g., 100 USDC)
    return Math.floor(price * 1e6).toString();
  }
}

router.post('/', async (req, res) => {
  try {
    const body = quoteRequestSchema.parse(req.body);
    
    // Validate that either merchantOwner or merchantId is provided
    if (!body.merchantOwner && !body.merchantId) {
      return res.status(400).json({ error: 'Either merchantOwner or merchantId must be provided' });
    }

    // Get merchant config
    const merchant = body.merchantId
      ? await getMerchantConfigById(body.merchantId)
      : await getMerchantConfig(body.merchantOwner!);
    
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

    // Calculate amount from price
    const amount = priceToAmount(body.price, body.payToken);
    const amountBigInt = BigInt(amount);

    // Use provided BPS or defaults
    const payoutBps = body.payoutBps ?? merchant.default_payout_bps;
    const buybackBps = body.buybackBps ?? merchant.default_buyback_bps;
    const burnBps = body.burnBps ?? merchant.default_burn_bps;

    // Validate BPS
    if (payoutBps + buybackBps > 10000) {
      return res.status(400).json({ 
        error: 'Invalid BPS: payout + buyback cannot exceed 10000' 
      });
    }

    // Calculate buyback amount
    const buybackAmount = (amountBigInt * BigInt(buybackBps)) / BigInt(10000);

    if (buybackAmount === 0n) {
      // No buyback, return quote with min_out = 0
      return res.json({
        quoteId: randomUUID(),
        merchantId: merchant.merchant_id,
        amount: amount,
        payToken: body.payToken,
        payoutBps,
        buybackBps,
        burnBps,
        buybackAmount: '0',
        minOut: '0',
        estimatedTokens: '0',
        slippageBps: merchant.slippage_bps,
        expiresAt: Math.floor(Date.now() / 1000) + 30, // 30 seconds
      });
    }

    // Get connection (from env or default)
    const rpcUrl = process.env.RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    const usdcMint = getUsdcMint(rpcUrl.includes('mainnet') ? 'mainnet' : 'devnet');

    let quote: any = null;
    let swapTransaction: string | undefined = undefined;
    let minOut = '0';
    let estimatedTokens = '0';

    // For buyback swaps, we need to get the swap transaction
    // Note: We use a dummy payer address for quote generation
    // The actual payer will be set when building the transaction
    const dummyPayer = '11111111111111111111111111111111'; // System program (dummy)

    if (body.payToken === 'USDC') {
      // Multi-hop: USDC → SOL → buyback_token
      const multiHopQuote = await getMultiHopQuote(
        usdcMint.toBase58(),
        SOL_MINT,
        merchant.buyback_mint,
        buybackAmount.toString(),
        merchant.slippage_bps
      );

      if (!multiHopQuote || !multiHopQuote.solToBuyback) {
        return res.status(500).json({ error: 'Failed to get multi-hop quote from Jupiter' });
      }

      quote = multiHopQuote;
      estimatedTokens = multiHopQuote.totalOutAmount;
      
      // Get swap transaction for SOL → buyback_token (the final hop)
      // Note: For multi-hop, we only need the final swap transaction
      // The USDC → SOL swap will be handled separately if needed
      const swapRoute = await getJupiterSwapTransaction(
        multiHopQuote.solToBuyback,
        dummyPayer,
        true, // wrapUnwrapSOL
        true, // dynamicComputeUnitLimit
      );

      if (swapRoute) {
        swapTransaction = swapRoute.swapTransaction;
      }
      
      // Calculate minOut with slippage
      const estimatedTokensBigInt = BigInt(estimatedTokens);
      minOut = (estimatedTokensBigInt * BigInt(10000 - merchant.slippage_bps) / BigInt(10000)).toString();
    } else {
      // Single hop: SOL → buyback_token
      const solQuote = await getJupiterQuote(
        SOL_MINT,
        merchant.buyback_mint,
        buybackAmount.toString(),
        merchant.slippage_bps
      );

      if (!solQuote) {
        return res.status(500).json({ error: 'Failed to get quote from Jupiter' });
      }

      quote = solQuote;
      estimatedTokens = solQuote.outAmount;
      
      // Get swap transaction
      const swapRoute = await getJupiterSwapTransaction(
        solQuote,
        dummyPayer,
        true, // wrapUnwrapSOL
        true, // dynamicComputeUnitLimit
      );

      if (swapRoute) {
        swapTransaction = swapRoute.swapTransaction;
      }
      
      // Calculate minOut with slippage
      const estimatedTokensBigInt = BigInt(estimatedTokens);
      minOut = (estimatedTokensBigInt * BigInt(10000 - merchant.slippage_bps) / BigInt(10000)).toString();
    }

    res.json({
      quoteId: randomUUID(),
      merchantId: merchant.merchant_id,
      amount: amount,
      payToken: body.payToken,
      payoutBps,
      buybackBps,
      burnBps,
      buybackAmount: buybackAmount.toString(),
      minOut,
      estimatedTokens,
      slippageBps: merchant.slippage_bps,
      quote: quote, // Include full quote for transaction building
      swapTransaction: swapTransaction, // Include swap transaction for remaining accounts
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

export { router as quoteV2Router };

