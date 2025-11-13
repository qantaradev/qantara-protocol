import axios from 'axios';
import { PublicKey, Connection } from '@solana/web3.js';

/**
 * Jupiter API URL
 * 
 * Jupiter has two tiers:
 * - Lite Tier: No API key required, uses https://lite-api.jup.ag/
 * - Pro Tier: Requires API key, uses https://api.jup.ag/
 * 
 * Note: The old endpoint https://quote-api.jup.ag/v6/ has been deprecated.
 * 
 * The API automatically detects network based on token mints.
 * The same endpoint works for both mainnet and devnet.
 */
const JUPITER_API_URL = process.env.JUPITER_API_URL || 'https://lite-api.jup.ag';

/**
 * Get Jupiter API URL based on network
 * Currently Jupiter uses the same endpoint for both networks
 * but this allows for future network-specific endpoints
 */
export function getJupiterApiUrl(network: 'mainnet' | 'devnet' = 'mainnet'): string {
  // Jupiter API automatically detects network from token mints
  // Same endpoint works for both mainnet and devnet
  return JUPITER_API_URL;
}

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  routePlan?: any;
  contextSlot?: number;
  timeTaken?: number;
}

export interface JupiterSwapRoute {
  quote: JupiterQuote;
  swapTransaction: string; // Base64 encoded transaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
}

/**
 * Get Jupiter quote for a swap
 * 
 * Uses Jupiter Lite API v1 (no API key required)
 */
export async function getJupiterQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps: number
): Promise<JupiterQuote | null> {
  try {
    const slippageBpsNum = slippageBps / 100; // Convert bps to percentage
    
    // Jupiter Lite API v1 endpoint
    const response = await axios.get(`${JUPITER_API_URL}/swap/v1/quote`, {
      params: {
        inputMint,
        outputMint,
        amount,
        slippageBps: slippageBpsNum,
        onlyDirectRoutes: false,
        asLegacyTransaction: false,
      },
    });

    return {
      inputMint: response.data.inputMint,
      outputMint: response.data.outputMint,
      inAmount: response.data.inAmount,
      outAmount: response.data.outAmount,
      routePlan: response.data.routePlan,
      contextSlot: response.data.contextSlot,
      timeTaken: response.data.timeTaken,
    };
  } catch (error: any) {
    console.error('Jupiter quote error:', error.message);
    if (error.response) {
      console.error('Jupiter API response:', error.response.data);
    }
    return null;
  }
}

/**
 * Get Jupiter swap transaction (for multi-hop routes)
 * 
 * Uses Jupiter Lite API v1 (no API key required)
 */
export async function getJupiterSwapTransaction(
  quote: JupiterQuote,
  userPublicKey: string,
  wrapUnwrapSOL: boolean = true,
  dynamicComputeUnitLimit: boolean = true,
  prioritizationFeeLamports?: number
): Promise<JupiterSwapRoute | null> {
  try {
    // Jupiter Lite API v1 endpoint
    const response = await axios.post(`${JUPITER_API_URL}/swap/v1`, {
      quoteResponse: quote,
      userPublicKey,
      wrapUnwrapSOL,
      dynamicComputeUnitLimit,
      prioritizationFeeLamports,
    });

    return {
      quote,
      swapTransaction: response.data.swapTransaction,
      lastValidBlockHeight: response.data.lastValidBlockHeight,
      prioritizationFeeLamports: response.data.prioritizationFeeLamports,
    };
  } catch (error: any) {
    console.error('Jupiter swap transaction error:', error.message);
    if (error.response) {
      console.error('Jupiter API response:', error.response.data);
    }
    return null;
  }
}

/**
 * Get multi-hop quote for USDC → SOL → buyback_token
 * Returns quotes for both swaps
 */
export async function getMultiHopQuote(
  usdcMint: string,
  solMint: string,
  buybackMint: string,
  usdcAmount: string,
  slippageBps: number
): Promise<{
  usdcToSol: JupiterQuote | null;
  solToBuyback: JupiterQuote | null;
  totalOutAmount: string;
} | null> {
  try {
    // Step 1: Get USDC → SOL quote
    const usdcToSolQuote = await getJupiterQuote(
      usdcMint,
      solMint,
      usdcAmount,
      slippageBps
    );

    if (!usdcToSolQuote) {
      return null;
    }

    // Step 2: Get SOL → buyback_token quote
    // Use the output amount from first swap as input
    const solToBuybackQuote = await getJupiterQuote(
      solMint,
      buybackMint,
      usdcToSolQuote.outAmount,
      slippageBps
    );

    if (!solToBuybackQuote) {
      return null;
    }

    return {
      usdcToSol: usdcToSolQuote,
      solToBuyback: solToBuybackQuote,
      totalOutAmount: solToBuybackQuote.outAmount,
    };
  } catch (error: any) {
    console.error('Multi-hop quote error:', error.message);
    return null;
  }
}

/**
 * SOL mint address
 */
export const SOL_MINT = 'So11111111111111111111111111111111111111112';

