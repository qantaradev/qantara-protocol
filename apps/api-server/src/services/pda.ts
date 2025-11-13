import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

/**
 * V2 Program ID
 * 
 * This can be overridden via QANTARA_V2_PROGRAM_ID environment variable.
 * Default is the devnet deployment address.
 * 
 * For mainnet, set QANTARA_V2_PROGRAM_ID in your environment.
 */
export const QANTARA_V2_PROGRAM_ID = new PublicKey(
  process.env.QANTARA_V2_PROGRAM_ID || 'JCjXHcUy7LzJsLBoafjem9wRffRyuyGYsiTz35Yyr9AH'
);

// USDC Mint (devnet)
export const USDC_MINT_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
// USDC Mint (mainnet)
export const USDC_MINT_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

/**
 * Derive protocol config PDA
 */
export function deriveProtocolConfigPDA(programId: PublicKey = QANTARA_V2_PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('protocol')],
    programId
  );
}

/**
 * Derive vault SOL PDA
 */
export function deriveVaultSolPDA(programId: PublicKey = QANTARA_V2_PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), Buffer.from('sol')],
    programId
  );
}

/**
 * Derive vault USDC PDA
 */
export function deriveVaultUsdcPDA(
  usdcMint: PublicKey,
  programId: PublicKey = QANTARA_V2_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault_usdc'), usdcMint.toBuffer()],
    programId
  );
}

/**
 * Derive merchant registry PDA
 */
export function deriveMerchantRegistryPDA(
  merchantId: BN | string | number,
  programId: PublicKey = QANTARA_V2_PROGRAM_ID
): [PublicKey, number] {
  const merchantIdBN = typeof merchantId === 'string' || typeof merchantId === 'number'
    ? new BN(merchantId)
    : merchantId;
  
  const merchantIdBytes = merchantIdBN.toArrayLike(Buffer, 'le', 8);
  
  return PublicKey.findProgramAddressSync(
    [Buffer.from('merchant'), merchantIdBytes],
    programId
  );
}

/**
 * Get USDC mint based on cluster
 */
export function getUsdcMint(cluster: 'devnet' | 'mainnet' = 'devnet'): PublicKey {
  return cluster === 'mainnet' ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;
}

/**
 * Derive all protocol PDAs (centralized accounts)
 */
export function deriveProtocolAccounts(
  usdcMint: PublicKey,
  programId: PublicKey = QANTARA_V2_PROGRAM_ID
) {
  const [protocolConfigPDA] = deriveProtocolConfigPDA(programId);
  const [vaultSolPDA] = deriveVaultSolPDA(programId);
  const [vaultUsdcPDA] = deriveVaultUsdcPDA(usdcMint, programId);

  return {
    protocolConfigPDA,
    vaultSolPDA,
    vaultUsdcPDA,
  };
}

/**
 * Derive merchant-specific PDAs
 */
export function deriveMerchantAccounts(
  merchantId: BN | string | number,
  programId: PublicKey = QANTARA_V2_PROGRAM_ID
) {
  const [merchantRegistryPDA] = deriveMerchantRegistryPDA(merchantId, programId);

  return {
    merchantRegistryPDA,
  };
}

