#!/usr/bin/env ts-node

/**
 * Fund test accounts from main wallet
 * Usage: npx ts-node scripts/fund-test-accounts.ts
 */

import { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { readFileSync } from "fs";
import { join } from "path";

// Use the wallet from environment or default path
const SOURCE_WALLET_ADDRESS = "2KvYGjW7SXJQDwBxnTWDdLqQyGXQfrvxZkHKwHBkoYNV";
const SOURCE_WALLET_PATH = process.env.ANCHOR_WALLET || join(process.env.HOME || "", ".config/solana/id.json");
const RPC_URL = process.env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com";

// Test accounts that need funding
const TEST_ACCOUNTS = {
  protocolAuthority: new PublicKey("4S44fQVnGVy7gaa4RGJN48mGxe9RMphQtnUiT5zWPRCf"),
  merchantOwner: new PublicKey("H45pfHRnXu9td4Y35gLEsEL1AahDyeWpNBcFnSKjDH7s"),
  buyer: new PublicKey("9GVwo3GfCSrda5mX3SgWbqY2GSHWvL2LvnmiB2R96dx2"),
};

// Amounts to transfer (in SOL)
const AMOUNTS = {
  protocolAuthority: 0.1,
  merchantOwner: 0.1,
  buyer: 0.5,
};

async function main() {
  console.log("💰 Funding test accounts from wallet...\n");

  // Load source wallet
  let sourceWalletKeypair: Keypair;
  try {
    sourceWalletKeypair = Keypair.fromSecretKey(
      Buffer.from(JSON.parse(readFileSync(SOURCE_WALLET_PATH, "utf8")))
    );
  } catch (error) {
    console.error(`❌ Could not load wallet from ${SOURCE_WALLET_PATH}`);
    console.error(`   Error: ${error}`);
    console.error(`   Please ensure ANCHOR_WALLET is set or wallet exists at default path`);
    process.exit(1);
  }
  
  const sourceWallet = sourceWalletKeypair.publicKey;
  const expectedWallet = new PublicKey(SOURCE_WALLET_ADDRESS);
  
  if (!sourceWallet.equals(expectedWallet)) {
    console.warn(`⚠️  Warning: Wallet address mismatch!`);
    console.warn(`   Expected: ${SOURCE_WALLET_ADDRESS}`);
    console.warn(`   Found:    ${sourceWallet.toBase58()}`);
    console.warn(`   Continuing with found wallet...\n`);
  }

  console.log(`📤 Source wallet: ${sourceWallet.toBase58()}\n`);

  // Connect to devnet
  const connection = new Connection(RPC_URL, "confirmed");

  // Check source wallet balance
  const balance = await connection.getBalance(sourceWallet);
  const balanceSol = balance / LAMPORTS_PER_SOL;
  console.log(`📊 Source wallet balance: ${balanceSol.toFixed(4)} SOL\n`);

  // Calculate total needed
  const totalNeeded = Object.values(AMOUNTS).reduce((a, b) => a + b, 0);
  console.log(`💸 Total needed: ${totalNeeded} SOL\n`);

  if (balanceSol < totalNeeded + 0.01) {
    console.error(`❌ Insufficient balance. Need ${totalNeeded + 0.01} SOL, have ${balanceSol} SOL`);
    process.exit(1);
  }

  // Transfer to each account
  for (const [name, pubkey] of Object.entries(TEST_ACCOUNTS)) {
    const amount = AMOUNTS[name as keyof typeof AMOUNTS];
    const amountLamports = amount * LAMPORTS_PER_SOL;

    console.log(`📤 Transferring ${amount} SOL to ${name} (${pubkey.toBase58()})...`);

    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: sourceWallet,
          toPubkey: pubkey,
          lamports: amountLamports,
        })
      );

      const signature = await connection.sendTransaction(transaction, [sourceWalletKeypair]);
      await connection.confirmTransaction(signature, "confirmed");

      console.log(`   ✅ Done: ${signature}\n`);
    } catch (error: any) {
      console.error(`   ❌ Failed: ${error.message}\n`);
      throw error;
    }
  }

  console.log("✅ All test accounts funded!\n");

  // Check final balances
  console.log("📋 Final balances:");
  for (const [name, pubkey] of Object.entries(TEST_ACCOUNTS)) {
    const balance = await connection.getBalance(pubkey);
    const balanceSol = balance / LAMPORTS_PER_SOL;
    console.log(`   ${name}: ${balanceSol.toFixed(4)} SOL`);
  }
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});

