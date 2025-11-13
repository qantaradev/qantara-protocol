import {
  Connection,
  PublicKey,
  VersionedTransaction,
  ComputeBudgetProgram,
  TransactionMessage,
} from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { SystemProgram } from '@solana/web3.js';
import { getProgram } from './program';
import {
  deriveProtocolAccounts,
  deriveMerchantAccounts,
  getUsdcMint,
  QANTARA_V2_PROGRAM_ID,
} from './pda';
import { getJupiterSwapTransaction, SOL_MINT } from './jupiter';
import { extractJupiterSwapAccounts, extractMultiHopSwapAccounts, filterDuplicateAccounts } from './jupiter-accounts';
import BNjs from 'bn.js';
import { BN } from '@coral-xyz/anchor';

export interface BuildSettleTransactionParams {
  connection: Connection;
  merchantId: string | BNjs | BN;
  payer: PublicKey;
  amount: BNjs | BN | string | number;
  payToken: 'SOL' | 'USDC';
  minOut: BNjs | BN | string | number;
  payoutBps: number;
  buybackBps: number;
  burnBps: number;
  merchant: {
    merchantRegistryPDA: PublicKey;
    payoutWallet: PublicKey;
    buybackMint: PublicKey;
    vaultBuybackToken: PublicKey;
  };
  protocol: {
    protocolConfigPDA: PublicKey;
    vaultSolPDA: PublicKey;
    vaultUsdcPDA: PublicKey;
    protocolWallet: PublicKey;
    jupiterRouter: PublicKey;
  };
  jupiterQuote?: {
    quote: any;
    swapTransaction?: string;
  };
  priorityFee?: number;
}

/**
 * Build settle transaction for V2 program
 */
export async function buildSettleTransaction(
  params: BuildSettleTransactionParams
): Promise<VersionedTransaction> {
  const {
    connection,
    merchantId,
    payer,
    amount,
    payToken,
    minOut,
    payoutBps,
    buybackBps,
    burnBps,
    merchant,
    protocol,
    jupiterQuote,
    priorityFee,
  } = params;

  // Get program instance
  const program = getProgram(connection);

  // Convert amounts to Anchor BN
  const amountBN = typeof amount === 'string' || typeof amount === 'number'
    ? new BN(amount.toString())
    : amount instanceof BNjs
    ? new BN(amount.toString())
    : new BN(amount.toString());
  
  const minOutBN = typeof minOut === 'string' || typeof minOut === 'number'
    ? new BN(minOut.toString())
    : minOut instanceof BNjs
    ? new BN(minOut.toString())
    : new BN(minOut.toString());

  // Convert merchantId to Anchor BN
  const merchantIdBN = typeof merchantId === 'string' || typeof merchantId === 'number'
    ? new BN(merchantId.toString())
    : merchantId instanceof BNjs
    ? new BN(merchantId.toString())
    : new BN(merchantId.toString());

  // Get USDC mint
  const usdcMint = getUsdcMint(
    connection.rpcEndpoint.includes('mainnet') ? 'mainnet' : 'devnet'
  );

  // Get payer's USDC account (if USDC payment)
  let payerUsdcAccount: PublicKey | null = null;
  if (payToken === 'USDC') {
    payerUsdcAccount = getAssociatedTokenAddressSync(
      usdcMint,
      payer,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  }

  // Get protocol wallet USDC account
  const protocolWalletUsdc = getAssociatedTokenAddressSync(
    usdcMint,
    protocol.protocolWallet,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Get merchant payout USDC account
  const merchantPayoutUsdc = getAssociatedTokenAddressSync(
    usdcMint,
    merchant.payoutWallet,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  // Build settle instruction
  // If buyback > 0, we need to add Jupiter swap accounts as remaining accounts
  let settleBuilder = program.methods
    .settle(
      merchantIdBN,
      amountBN,
      payToken === 'SOL' ? { sol: {} } : { usdc: {} },
      minOutBN,
      payoutBps,
      buybackBps,
      burnBps
    )
    .accounts({
      protocolConfig: protocol.protocolConfigPDA,
      merchantRegistry: merchant.merchantRegistryPDA,
      payer: payer,
      vaultSol: protocol.vaultSolPDA,
      vaultUsdc: protocol.vaultUsdcPDA,
      usdcMint: usdcMint,
      vaultBuybackToken: merchant.vaultBuybackToken,
      buybackMint: merchant.buybackMint,
      protocolWallet: protocol.protocolWallet,
      protocolWalletUsdc: protocolWalletUsdc,
      merchantPayoutWallet: merchant.payoutWallet,
      merchantPayoutUsdc: merchantPayoutUsdc,
      payerUsdcAccount: payerUsdcAccount || payer, // Fallback if SOL payment
      jupiterRouter: protocol.jupiterRouter,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    });

  // Add Jupiter swap accounts as remaining accounts if buyback > 0
  if (buybackBps > 0 && jupiterQuote?.swapTransaction) {
    try {
      // Extract account metas from Jupiter swap transaction
      // Only extract accounts from instructions that target the Jupiter router
      const jupiterAccounts = extractJupiterSwapAccounts(
        jupiterQuote.swapTransaction,
        protocol.jupiterRouter
      );
      
      // Filter out accounts that are already in the settle instruction
      const existingAccounts = [
        protocol.protocolConfigPDA,
        merchant.merchantRegistryPDA,
        payer,
        protocol.vaultSolPDA,
        protocol.vaultUsdcPDA,
        usdcMint,
        merchant.vaultBuybackToken,
        merchant.buybackMint,
        protocol.protocolWallet,
        protocolWalletUsdc,
        merchant.payoutWallet,
        merchantPayoutUsdc,
        payerUsdcAccount || payer,
        protocol.jupiterRouter,
        TOKEN_PROGRAM_ID,
        SystemProgram.programId,
      ];
      
      const filteredAccounts = filterDuplicateAccounts(jupiterAccounts, existingAccounts);
      
      // Add as remaining accounts
      if (filteredAccounts.length > 0) {
        settleBuilder = settleBuilder.remainingAccounts(filteredAccounts);
      }
    } catch (error: any) {
      console.error('Error adding Jupiter swap accounts:', error.message);
      // Continue without remaining accounts - the swap will fail but transaction can still be built
      // In production, you might want to throw here or handle this more gracefully
    }
  }

  const settleIx = await settleBuilder.instruction();

  // Get recent blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

  // Build transaction message
  const instructions = [];

  // Add priority fee if specified
  if (priorityFee) {
    instructions.push(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: priorityFee,
      })
    );
  }

  // Add settle instruction
  instructions.push(settleIx);

  // Create versioned transaction
  const messageV0 = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  return new VersionedTransaction(messageV0);
}

/**
 * Helper to get all required accounts for settle instruction
 */
export async function getSettleAccounts(
  connection: Connection,
  merchantId: string | BNjs | BN,
  merchantOwner: PublicKey,
  payoutWallet: PublicKey,
  buybackMint: PublicKey,
  vaultBuybackToken: PublicKey
) {
  const usdcMint = getUsdcMint(
    connection.rpcEndpoint.includes('mainnet') ? 'mainnet' : 'devnet'
  );

  // Derive protocol accounts (centralized)
  const protocolAccounts = deriveProtocolAccounts(usdcMint);

  // Derive merchant accounts
  const merchantAccounts = deriveMerchantAccounts(merchantId);

  // Fetch protocol config to get protocol wallet and Jupiter router
  const program = getProgram(connection);
  const protocolConfig = await program.account.protocolConfig.fetch(
    protocolAccounts.protocolConfigPDA
  );

  // Fetch merchant registry to validate
  const merchantRegistry = await program.account.merchantRegistry.fetch(
    merchantAccounts.merchantRegistryPDA
  );

  return {
    protocol: {
      ...protocolAccounts,
      protocolWallet: protocolConfig.protocolWallet as PublicKey,
      jupiterRouter: protocolConfig.jupiterRouter as PublicKey,
    },
    merchant: {
      ...merchantAccounts,
      payoutWallet,
      buybackMint,
      vaultBuybackToken,
    },
    usdcMint,
  };
}
