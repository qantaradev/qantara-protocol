import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'qantara-api-v2',
    timestamp: new Date().toISOString(),
  });
});

export const healthRouter = router;
export default router;
