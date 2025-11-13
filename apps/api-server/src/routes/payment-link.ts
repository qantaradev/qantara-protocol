import { Router } from 'express';
import { z } from 'zod';
import { memoryStore } from '../services/memory-store';
import { getProgram } from '../services/program';
import { deriveMerchantRegistryPDA } from '../services/pda';
import { Connection, PublicKey } from '@solana/web3.js';

const router = Router();

/**
 * Create a new payment link
 * POST /api/payment-links
 */
const createLinkSchema = z.object({
  merchantId: z.string(),
  merchantOwner: z.string(),
  payoutWallet: z.string(),
  buybackMint: z.string(),
  price: z.number().positive(),
  payoutBps: z.number().min(0).max(10000),
  buybackBps: z.number().min(0).max(10000),
  burnBps: z.number().min(0).max(10000),
  description: z.string().optional(),
});

router.post('/', async (req, res) => {
  try {
    const body = createLinkSchema.parse(req.body);

    // Validate BPS
    if (body.payoutBps + body.buybackBps > 10000) {
      return res.status(400).json({
        error: 'Invalid BPS: payout + buyback cannot exceed 10000',
      });
    }

    // Verify merchant exists on-chain
    const connection = new Connection(
      process.env.RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );
    const program = getProgram(connection);
    const [merchantRegistryPDA] = deriveMerchantRegistryPDA(body.merchantId);

    try {
      const merchant = await program.account.merchantRegistry.fetch(merchantRegistryPDA);
      
      // Verify merchant owner matches
      if (merchant.owner.toString() !== body.merchantOwner) {
        return res.status(403).json({
          error: 'Merchant owner mismatch',
        });
      }

      // Verify merchant is not frozen
      if (merchant.frozen) {
        return res.status(403).json({
          error: 'Merchant is frozen',
        });
      }
    } catch (error) {
      return res.status(404).json({
        error: 'Merchant not found on-chain. Please register first.',
      });
    }

    // Create payment link
    const link = memoryStore.createPaymentLink({
      merchantId: body.merchantId,
      merchantOwner: body.merchantOwner,
      payoutWallet: body.payoutWallet,
      buybackMint: body.buybackMint,
      price: body.price,
      payoutBps: body.payoutBps,
      buybackBps: body.buybackBps,
      burnBps: body.burnBps,
      description: body.description,
    });

    res.json({
      linkId: link.linkId,
      paymentUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/pay/${link.linkId}`,
      createdAt: link.createdAt,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    console.error('Create payment link error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get payment link data
 * GET /api/payment-links/:linkId
 */
router.get('/:linkId', async (req, res) => {
  try {
    const { linkId } = req.params;

    const link = memoryStore.getPaymentLink(linkId);
    if (!link) {
      return res.status(404).json({ error: 'Payment link not found' });
    }

    // Fetch merchant from on-chain for latest data
    const connection = new Connection(
      process.env.RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    );
    const program = getProgram(connection);
    const [merchantRegistryPDA] = deriveMerchantRegistryPDA(link.merchantId);

    try {
      const merchant = await program.account.merchantRegistry.fetch(merchantRegistryPDA);

      res.json({
        linkId: link.linkId,
        price: link.price,
        description: link.description,
        merchantId: link.merchantId,
        payoutWallet: link.payoutWallet,
        buybackMint: link.buybackMint,
        payoutBps: link.payoutBps,
        buybackBps: link.buybackBps,
        burnBps: link.burnBps,
        merchant: {
          owner: merchant.owner.toString(),
          payoutWallet: merchant.payoutWallet.toString(),
          buybackMint: merchant.buybackMint.toString(),
          frozen: merchant.frozen,
        },
        createdAt: link.createdAt,
      });
    } catch (error) {
      return res.status(404).json({
        error: 'Merchant not found on-chain',
      });
    }
  } catch (error: any) {
    console.error('Get payment link error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all payment links for a merchant
 * GET /api/payment-links/merchant/:merchantId
 */
router.get('/merchant/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const links = memoryStore.getMerchantLinks(merchantId);

    res.json({
      merchantId,
      links: links.map(link => ({
        linkId: link.linkId,
        price: link.price,
        description: link.description,
        paymentUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/pay/${link.linkId}`,
        createdAt: link.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Get merchant links error:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router as paymentLinkRouter };

