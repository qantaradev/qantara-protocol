/**
 * Environment variable validation and configuration
 */

import { z } from 'zod';

const envSchema = z.object({
  // Server
  API_PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Solana
  RPC_URL: z.string().url(),
  QANTARA_V2_PROGRAM_ID: z.string().optional(),
  
  // Database
  DATABASE_URL: z.string().url(),
  
  // Service Wallet
  SERVICE_WALLET_PRIVATE_KEY: z.string().min(1),
  
  // Jupiter
  JUPITER_API_URL: z.string().url().optional(),
  JUPITER_API_KEY: z.string().optional(),
  
  // CORS
  ALLOWED_ORIGINS: z.string().optional(),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).optional(),
  
  // IDL Path (optional override)
  IDL_PATH: z.string().optional(),
});

type EnvConfig = z.infer<typeof envSchema>;

let validatedConfig: EnvConfig | null = null;

/**
 * Validate and get environment configuration
 */
export function getEnvConfig(): EnvConfig {
  if (validatedConfig) {
    return validatedConfig;
  }

  try {
    validatedConfig = envSchema.parse(process.env);
    return validatedConfig;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors
        .filter(e => e.code === 'invalid_type' && e.received === 'undefined')
        .map(e => e.path.join('.'));
      
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}\n` +
        `See env.example for all required variables.`
      );
    }
    throw error;
  }
}

/**
 * Get network type from RPC URL
 */
export function getNetwork(): 'devnet' | 'mainnet' {
  const config = getEnvConfig();
  const rpcUrl = config.RPC_URL.toLowerCase();
  
  if (rpcUrl.includes('devnet')) {
    return 'devnet';
  }
  if (rpcUrl.includes('mainnet') || rpcUrl.includes('mainnet-beta')) {
    return 'mainnet';
  }
  
  // Default to devnet if unclear
  console.warn(`Could not determine network from RPC_URL: ${config.RPC_URL}, defaulting to devnet`);
  return 'devnet';
}

/**
 * Validate environment on startup
 */
export function validateEnvironment(): void {
  try {
    const config = getEnvConfig();
    const network = getNetwork();
    
    console.log('✅ Environment configuration:');
    console.log(`   Network: ${network}`);
    console.log(`   RPC URL: ${config.RPC_URL}`);
    console.log(`   API Port: ${config.API_PORT}`);
    console.log(`   Node Env: ${config.NODE_ENV}`);
    
    if (config.QANTARA_V2_PROGRAM_ID) {
      console.log(`   Program ID: ${config.QANTARA_V2_PROGRAM_ID}`);
    } else {
      console.log(`   Program ID: Using default (devnet)`);
    }
    
    // Warn about production settings
    if (config.NODE_ENV === 'production') {
      if (!config.ALLOWED_ORIGINS) {
        console.warn('⚠️  ALLOWED_ORIGINS not set - CORS allows all origins');
      }
      if (config.RPC_URL.includes('api.devnet.solana.com')) {
        console.warn('⚠️  Using devnet RPC in production mode');
      }
    }
  } catch (error: any) {
    console.error('❌ Environment validation failed:');
    console.error(error.message);
    process.exit(1);
  }
}

