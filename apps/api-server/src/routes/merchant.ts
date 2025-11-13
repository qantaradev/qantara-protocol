import { Router } from 'express';
import { getMerchantConfig } from '../services/database';

const router = Router();

router.get('/:owner', async (req, res) => {
  try {
    const { owner } = req.params;
    
    const merchant = await getMerchantConfig(owner);
    if (!merchant) {
      return res.status(404).json({ error: 'Merchant not found' });
    }

    // Return public data only
    res.json({
      owner: merchant.owner_pubkey,
      buybackMint: merchant.buyback_mint,
      allowSol: merchant.allow_sol,
      allowUsdc: merchant.allow_usdc,
      frozen: merchant.frozen,
    });
  } catch (error: any) {
    console.error('Get merchant error:', error);
    res.status(500).json({ error: error.message });
  }
});

export { router as merchantRouter };

