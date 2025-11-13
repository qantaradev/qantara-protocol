/**
 * Jupiter Swap Account Extraction
 * 
 * Extracts account metas from Jupiter swap transactions to be used as
 * remaining accounts in the settle instruction.
 */

import {
  VersionedTransaction,
  TransactionMessage,
  AccountMeta,
  PublicKey,
} from '@solana/web3.js';

/**
 * Extract account metas from a Jupiter swap transaction
 * 
 * Jupiter v6 swap transactions contain one or more swap instructions.
 * We need to extract all unique accounts from the Jupiter swap instruction
 * and pass them as remaining accounts to the settle instruction.
 * 
 * Note: We specifically look for the Jupiter swap instruction (program ID matches Jupiter router)
 * and extract accounts from that instruction only.
 */
export function extractJupiterSwapAccounts(
  swapTransactionBase64: string,
  jupiterRouterProgramId: PublicKey
): AccountMeta[] {
  try {
    // Deserialize the Jupiter swap transaction
    const swapTxBuffer = Buffer.from(swapTransactionBase64, 'base64');
    const swapTx = VersionedTransaction.deserialize(swapTxBuffer);

    // Decompile the transaction message to get instructions
    const message = TransactionMessage.decompile(swapTx.message);
    
    // Collect all unique accounts from Jupiter swap instructions only
    const accountMap = new Map<string, AccountMeta>();
    
    // Process all instructions in the swap transaction
    for (const instruction of message.instructions) {
      // Only process instructions that target the Jupiter router program
      if (instruction.programId.toBase58() === jupiterRouterProgramId.toBase58()) {
        // Add all accounts from this Jupiter swap instruction
        for (let i = 0; i < instruction.keys.length; i++) {
          const accountMeta = instruction.keys[i];
          const pubkeyStr = accountMeta.pubkey.toBase58();
          
          // Use the account if we haven't seen it, or if this one is writable/signer
          if (!accountMap.has(pubkeyStr)) {
            accountMap.set(pubkeyStr, {
              pubkey: accountMeta.pubkey,
              isSigner: accountMeta.isSigner,
              isWritable: accountMeta.isWritable,
            });
          } else {
            // Update if this instance has more permissions (writable or signer)
            const existing = accountMap.get(pubkeyStr)!;
            if (accountMeta.isWritable && !existing.isWritable) {
              existing.isWritable = true;
            }
            if (accountMeta.isSigner && !existing.isSigner) {
              existing.isSigner = true;
            }
          }
        }
      }
    }

    // Convert map to array
    return Array.from(accountMap.values());
  } catch (error: any) {
    console.error('Error extracting Jupiter swap accounts:', error.message);
    throw new Error(`Failed to extract Jupiter swap accounts: ${error.message}`);
  }
}

/**
 * Extract account metas from multiple Jupiter swap transactions
 * (For multi-hop swaps like USDC → SOL → buyback_token)
 */
export function extractMultiHopSwapAccounts(
  swapTransactions: string[],
  jupiterRouterProgramId: PublicKey
): AccountMeta[] {
  const allAccounts = new Map<string, AccountMeta>();

  for (const swapTxBase64 of swapTransactions) {
    const accounts = extractJupiterSwapAccounts(swapTxBase64, jupiterRouterProgramId);
    
    // Merge accounts, preserving the highest permission level
    for (const account of accounts) {
      const pubkeyStr = account.pubkey.toBase58();
      const existing = allAccounts.get(pubkeyStr);
      
      if (!existing) {
        allAccounts.set(pubkeyStr, account);
      } else {
        // Update permissions if needed
        if (account.isWritable && !existing.isWritable) {
          existing.isWritable = true;
        }
        if (account.isSigner && !existing.isSigner) {
          existing.isSigner = true;
        }
      }
    }
  }

  return Array.from(allAccounts.values());
}

/**
 * Filter out accounts that are already in the settle instruction
 * to avoid duplicates
 */
export function filterDuplicateAccounts(
  jupiterAccounts: AccountMeta[],
  existingAccounts: PublicKey[]
): AccountMeta[] {
  const existingSet = new Set(
    existingAccounts.map(acc => acc.toBase58())
  );

  return jupiterAccounts.filter(
    account => !existingSet.has(account.pubkey.toBase58())
  );
}


