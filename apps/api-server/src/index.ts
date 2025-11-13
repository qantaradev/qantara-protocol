import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { quoteRouter } from './routes/quote';
import { buildTxRouter } from './routes/build-tx';
import { merchantRouter } from './routes/merchant';
import { healthRouter } from './routes/health';
// V2 Routes
import { quoteV2Router } from './routes/quote-v2';
import { buildTxV2Router } from './routes/build-tx-v2';
import { merchantV2Router } from './routes/merchant-v2';
import { validateEnvironment, getEnvConfig } from './config/env';

dotenv.config();

// Validate environment on startup
validateEnvironment();

const app = express();
const config = getEnvConfig();
const PORT = config.API_PORT;

// Middleware
// CORS configuration
const allowedOrigins = config.ALLOWED_ORIGINS
  ? config.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [];

app.use(cors({
  origin: allowedOrigins.length > 0
    ? (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    : true, // Allow all in development if not specified
  credentials: true,
}));
app.use(express.json());

// V1 Routes (legacy - can be removed later)
app.use('/v1/quote', quoteRouter);
app.use('/v1/build-tx', buildTxRouter);
app.use('/v1/merchants', merchantRouter);

// V2 Routes (current)
app.use('/v2/quote', quoteV2Router);
app.use('/v2/build-tx', buildTxV2Router);
app.use('/v2/merchants', merchantV2Router);

// Payment Link Routes (MVP - no database)
import { paymentLinkRouter } from './routes/payment-link';
app.use('/api/payment-links', paymentLinkRouter);

// Health check
app.use('/health', healthRouter);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Qantara API server running on port ${PORT}`);
});

