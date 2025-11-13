import { PublicKey, Keypair } from "@solana/web3.js";
import { createMint, createAccount, mintTo } from "@solana/spl-token";
import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";

export const JUPITER_ROUTER_DEVNET = new PublicKey(
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"
);

export const USDC_MINT_DEVNET = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" // Devnet USDC
);

export const SOL_MINT = PublicKey.default; // Native SOL

export async function createTestMint(
  connection: Connection,
  payer: Keypair,
  decimals: number = 9
): Promise<PublicKey> {
  return await createMint(
    connection,
    payer,
    payer.publicKey,
    null,
    decimals
  );
}

export async function createAndFundTokenAccount(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  amount: bigint
): Promise<PublicKey> {
  const account = await createAccount(
    connection,
    payer,
    mint,
    payer.publicKey
  );

  await mintTo(
    connection,
    payer,
    mint,
    account,
    payer,
    amount
  );

  return account;
}

export async function airdropSol(
  connection: Connection,
  pubkey: PublicKey,
  amount: number = 10
): Promise<string> {
  const signature = await connection.requestAirdrop(
    pubkey,
    amount * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(signature);
  return signature;
}

