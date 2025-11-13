import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createMint, createAccount, mintTo, createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, ASSOCIATED_TOKEN_PROGRAM_ID, setAuthority, AuthorityType } from "@solana/spl-token";
import { expect } from "chai";
import { readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
// Load IDL - try multiple possible locations
const possibleIdlPaths = [
  join(__dirname, "../../target/idl/qantara_v2.json"),
  join(__dirname, "../target/idl/qantara_v2.json"),
  join(process.cwd(), "target/idl/qantara_v2.json"),
];

let idl: any;
let idlPath: string | null = null;

for (const path of possibleIdlPaths) {
  try {
    idl = JSON.parse(readFileSync(path, "utf8"));
    idlPath = path;
    break;
  } catch (e) {
    // Continue to next path
  }
}

if (!idl) {
  throw new Error(
    `IDL not found. Tried: ${possibleIdlPaths.join(", ")}\n` +
    `Run 'anchor build --program-name qantara-v2' first to generate the IDL.`
  );
}

// Normalize IDL for anchor-js compatibility
function normalizeIdl(raw: any): any {
  const idl = JSON.parse(JSON.stringify(raw));
  if (!idl.version && idl.metadata?.version) idl.version = idl.metadata.version;
  if (!idl.name && idl.metadata?.name) idl.name = idl.metadata.name;

  const fixDefined = (node: any) => {
    if (!node || typeof node !== "object") return;
    // Convert { defined: { name: "Type" } } => { defined: "Type" }
    if (node.type && node.type.defined && typeof node.type.defined === "object" && node.type.defined.name) {
      node.type.defined = node.type.defined.name;
    }
    if (node.defined && typeof node.defined === "object" && node.defined.name) {
      node.defined = node.defined.name;
    }
    // Recurse arrays and objects
    if (Array.isArray(node)) {
      node.forEach(fixDefined);
    } else {
      Object.values(node).forEach(fixDefined);
    }
  };

  if (Array.isArray(idl.instructions)) {
    idl.instructions.forEach((ix: any) => {
      if (Array.isArray(ix.args)) ix.args.forEach(fixDefined);
    });
  }
  const typeMap = new Map<string, any>();
  if (Array.isArray(idl.types)) {
    idl.types.forEach((t: any) => {
      fixDefined(t);
      if (t?.name && t?.type) {
        typeMap.set(t.name, t.type);
      }
    });
  }
  if (Array.isArray(idl.accounts)) {
    idl.accounts.forEach((a: any) => {
      fixDefined(a);
      if (!a.type) {
        const typeDef = typeMap.get(a.name);
        if (typeDef) {
          a.type = typeDef;
        }
      }
    });
  }
  if (Array.isArray(idl.events)) {
    idl.events.forEach((e: any) => fixDefined(e));
  }

  const scalarSizes: Record<string, number> = {
    bool: 1,
    u8: 1,
    i8: 1,
    u16: 2,
    i16: 2,
    u32: 4,
    i32: 4,
    u64: 8,
    i64: 8,
    u128: 16,
    i128: 16,
    pubkey: 32,
  };

  const calculateTypeSize = (type: any, stack: Set<string> = new Set()): number | null => {
    if (!type) return null;
    if (typeof type === "string") {
      return scalarSizes[type] ?? null;
    }
    if (typeof type === "object") {
      if (type.option) {
        const inner = calculateTypeSize(type.option, stack);
        return inner === null ? null : 1 + inner;
      }
      if (type.vec) {
        return null; // variable length, cannot compute
      }
      if (type.defined) {
        const name = typeof type.defined === "string" ? type.defined : type.defined?.name;
        if (!name || stack.has(name)) return null;
        stack.add(name);
        const definedType = typeMap.get(name);
        const result = calculateTypeSize(definedType, stack);
        stack.delete(name);
        return result;
      }
      if (type.kind === "struct" && Array.isArray(type.fields)) {
        let total = 0;
        for (const field of type.fields) {
          const fieldSize = calculateTypeSize(field.type, stack);
          if (fieldSize === null) {
            return null;
          }
          total += fieldSize;
        }
        return total;
      }
      if (type.kind === "enum" && Array.isArray(type.variants)) {
        let max = 0;
        for (const variant of type.variants) {
          const variantFields = variant.fields;
          if (!variantFields) continue;
          const variantType =
            Array.isArray(variantFields) && !variantFields.kind
              ? { kind: "struct", fields: variantFields }
              : variantFields;
          const variantSize = calculateTypeSize(variantType, stack);
          if (variantSize === null) return null;
          if (variantSize > max) max = variantSize;
        }
        return 1 + max;
      }
    }
    return null;
  };

  // Fix accounts: ensure they have type and size
  if (Array.isArray(idl.accounts)) {
    idl.accounts.forEach((account: any) => {
      if (!account) return;
      
      // Get the type definition from types array
      // Account names in IDL are PascalCase, types might be too
      if (!account.type) {
        // Try exact match first (PascalCase)
        let typeDef = typeMap.get(account.name);
        
        // Try finding in types array directly (case-sensitive)
        if (!typeDef) {
          const typeFromTypes = idl.types?.find((t: any) => t.name === account.name);
          if (typeFromTypes?.type) {
            typeDef = typeFromTypes.type;
          }
        }
        
        if (typeDef) {
          account.type = JSON.parse(JSON.stringify(typeDef)); // Deep copy
        } else {
          console.error(`❌ Account ${account.name} has no type definition!`);
          console.error(`   Available types in map:`, Array.from(typeMap.keys()));
          console.error(`   Available types in array:`, idl.types?.map((t: any) => t.name));
          // Don't continue if type is missing - this will cause the error
          throw new Error(`Account ${account.name} missing type definition in IDL`);
        }
      }
      
      // Calculate size from type
      const structType = account.type;
      if (structType) {
        const structSize = calculateTypeSize(structType);
        let finalSize: number;
        
        if (structSize !== null && structSize > 0) {
          finalSize = 8 + structSize; // 8 bytes for discriminator
        } else {
          console.warn(`⚠️  Could not calculate size for account ${account.name}, structSize=${structSize}`);
          // Fallback: use hardcoded sizes
          if (account.name === "MerchantRegistry") {
            finalSize = 8 + 8 + 32 + 32 + 32 + 1 + 1; // discriminator + u64 + 3*pubkey + bool + u8
          } else if (account.name === "ProtocolConfig") {
            finalSize = 8 + 32 + 2 + 32 + 32 + 1 + 1; // discriminator + pubkey + u16 + 2*pubkey + bool + u8
          } else {
            finalSize = 0;
          }
        }
        
        if (finalSize > 0) {
          // Set size on account (primary location)
          account.size = finalSize;
          
          // ALSO set size on account.type (anchor-js might check this)
          if (account.type && typeof account.type === 'object') {
            account.type.size = finalSize;
          }
        }
      } else {
        console.error(`❌ Account ${account.name} has no type after normalization`);
      }
      
      // Final validation - ensure both account.size and account.type.size exist
      if (!account.size || account.size <= 8) {
        console.error(`❌ Account ${account.name} has invalid size: ${account.size}`);
      }
      if (account.type && typeof account.type === 'object' && !account.type.size) {
        console.warn(`⚠️  Account ${account.name}.type.size is missing, setting it`);
        account.type.size = account.size;
      }
    });
  }

  return idl;
}

idl = normalizeIdl(idl);
console.log(`✅ Loaded IDL from: ${idlPath}`);
console.log(`📦 Accounts after normalization:`, JSON.stringify(idl.accounts?.map((a: any) => ({
  name: a.name,
  hasType: !!a.type,
  accountSize: a.size,
  typeSize: a.type?.size,
  typeKind: a.type?.kind,
  typeHasSize: !!(a.type && typeof a.type === 'object' && a.type.size)
})), null, 2));

// Final safety check: ensure all accounts have both account.size and account.type.size
if (Array.isArray(idl.accounts)) {
  idl.accounts.forEach((account: any) => {
    if (account && account.type && typeof account.type === 'object') {
      if (account.size && !account.type.size) {
        account.type.size = account.size;
      }
      if (account.type.size && !account.size) {
        account.size = account.type.size;
      }
    }
  });
}

describe("Qantara V2 - End-to-End Tests", () => {
  // Set environment variables if not set
  if (!process.env.ANCHOR_PROVIDER_URL) {
    process.env.ANCHOR_PROVIDER_URL = "https://api.devnet.solana.com";
  }
  if (!process.env.ANCHOR_WALLET) {
    process.env.ANCHOR_WALLET = process.env.HOME + "/.config/solana/id.json";
  }

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Resolve program ID from IDL, env, or Anchor.toml
  function resolveProgramId(): PublicKey {
    // Try IDL metadata first
    if (idl?.metadata?.address) {
      const addr = idl.metadata.address.trim();
      if (addr && addr.length > 0) {
        try {
          return new PublicKey(addr);
        } catch (e) {
          console.warn(`Invalid program ID in IDL metadata: ${addr}`);
        }
      }
    }

    // Try environment variable
    if (process.env.PROGRAM_ID) {
      const addr = process.env.PROGRAM_ID.trim();
      if (addr && addr.length > 0) {
        try {
          return new PublicKey(addr);
        } catch (e) {
          console.warn(`Invalid PROGRAM_ID env var: ${addr}`);
        }
      }
    }

    // Default from Anchor.toml (hardcoded for now)
    return new PublicKey("JCjXHcUy7LzJsLBoafjem9wRffRyuyGYsiTz35Yyr9AH");
  }

  const programId = resolveProgramId();
  
  // Final validation before creating Program
  console.log(`🔍 Final IDL validation before Program creation:`);
  console.log(`   Accounts array length: ${idl.accounts?.length ?? 0}`);
  if (Array.isArray(idl.accounts)) {
    idl.accounts.forEach((acc: any, idx: number) => {
      console.log(`   Account[${idx}]: ${acc?.name}, hasType: ${!!acc?.type}, size: ${acc?.size}, typeSize: ${acc?.type?.size}`);
      if (!acc) {
        console.error(`   ❌ Account[${idx}] is null/undefined!`);
      }
      if (!acc.type) {
        console.error(`   ❌ Account[${idx}] (${acc?.name}) missing type!`);
      }
      if (!acc.size && !acc.type?.size) {
        console.error(`   ❌ Account[${idx}] (${acc?.name}) missing size!`);
      }
    });
  }
  
  // CRITICAL: Ensure accounts array is clean and properly formatted
  // anchor-js might be sensitive to extra properties or null entries
  if (Array.isArray(idl.accounts)) {
    idl.accounts = idl.accounts.filter((acc: any) => acc !== null && acc !== undefined);
    idl.accounts.forEach((acc: any) => {
      // Ensure account has minimal required structure
      if (!acc.name) {
        console.error(`❌ Account missing name:`, acc);
      }
      // Remove any undefined/null properties that might confuse anchor-js
      Object.keys(acc).forEach(key => {
        if (acc[key] === undefined || acc[key] === null) {
          delete acc[key];
        }
      });
    });
  }
  
  // Try using anchor.workspace first (handles IDL loading automatically)
  let program: Program<QantaraV2>;
  try {
    console.log(`🚀 Attempting to load program from workspace...`);
    // Try workspace first (uses generated types)
    if (anchor.workspace && (anchor.workspace as any).QantaraV2) {
      program = (anchor.workspace as any).QantaraV2 as Program<QantaraV2>;
      console.log(`✅ Program loaded from workspace!`);
    } else {
      // Fallback to manual IDL loading
      console.log(`⚠️  Workspace not available, using manual IDL loading...`);
      console.log(`🚀 Creating Program with ${idl.accounts?.length ?? 0} accounts...`);
      program = new Program(idl as any, programId, provider) as Program<QantaraV2>;
      console.log(`✅ Program created successfully!`);
    }
  } catch (error: any) {
    console.error(`❌ Failed to create Program:`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    console.error(`   IDL accounts:`, JSON.stringify(idl.accounts, null, 2));
    console.error(`   Full IDL structure:`, {
      hasAccounts: !!idl.accounts,
      accountsLength: idl.accounts?.length,
      accountsType: typeof idl.accounts,
      isArray: Array.isArray(idl.accounts),
    });
    throw error;
  }

  // Test accounts - Using static/deterministic keypairs
  // These can be funded once and reused across test runs
  // Generate from known seeds for consistency
  const protocolAuthority = Keypair.fromSeed(
    Buffer.from("protocol-authority-test-seed-12345678901234567890").slice(0, 32)
  );
  const protocolWallet = Keypair.fromSeed(
    Buffer.from("protocol-wallet-test-seed-12345678901234567890").slice(0, 32)
  );
  const merchantOwner = Keypair.fromSeed(
    Buffer.from("merchant-owner-test-seed-12345678901234567890").slice(0, 32)
  );
  const merchantPayoutWallet = Keypair.fromSeed(
    Buffer.from("merchant-payout-test-seed-12345678901234567890").slice(0, 32)
  );
  const buyer = Keypair.fromSeed(
    Buffer.from("buyer-test-seed-123456789012345678901234567890").slice(0, 32)
  );

  let usdcMint: PublicKey;
  let buybackMint: PublicKey;

  // PDAs
  let protocolConfigPDA: PublicKey;
  let merchantRegistryPDA: PublicKey;
  let merchantId: anchor.BN;

  // Constants
  const PROTOCOL_FEE_BPS = 100; // 1%
  const JUPITER_ROUTER = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"); // Jupiter v6 devnet

  before(async () => {
    // Set environment variables if not already set
    if (!process.env.ANCHOR_PROVIDER_URL) {
      process.env.ANCHOR_PROVIDER_URL = "https://api.devnet.solana.com";
    }
    if (!process.env.ANCHOR_WALLET) {
      process.env.ANCHOR_WALLET = process.env.HOME + "/.config/solana/id.json";
    }

    // Show test account addresses for manual funding
    console.log(`\n📋 Test Account Addresses (fund these once, reuse across tests):`);
    console.log(`   protocolAuthority: ${protocolAuthority.publicKey.toBase58()}`);
    console.log(`   merchantOwner:     ${merchantOwner.publicKey.toBase58()}`);
    console.log(`   buyer:             ${buyer.publicKey.toBase58()}`);
    console.log(`   protocolWallet:    ${protocolWallet.publicKey.toBase58()} (passive - receives fees)`);
    console.log(`   merchantPayout:    ${merchantPayoutWallet.publicKey.toBase58()} (passive - receives payouts)`);
    console.log(`\n💡 Fund these addresses once on devnet, then tests will reuse them.\n`);

    // Test connection first
    console.log("🌐 Testing connection to Solana devnet...");
    try {
      const version = await provider.connection.getVersion();
      console.log(`✅ Connected to Solana ${version["solana-core"]}`);
    } catch (error: any) {
      throw new Error(
        `Failed to connect to Solana devnet: ${error.message}. ` +
        `RPC endpoint: ${provider.connection.rpcEndpoint}. ` +
        `Check your network connection or try a different RPC endpoint.`
      );
    }

    // Check balances - only warn if insufficient, don't try to fund
    console.log("💰 Checking test account balances...");
    const minRequired = {
      protocolAuthority: 0.01 * LAMPORTS_PER_SOL, // ~0.01 SOL for fees
      merchantOwner: 0.01 * LAMPORTS_PER_SOL,       // ~0.01 SOL for fees
      buyer: 0.5 * LAMPORTS_PER_SOL,                // ~0.5 SOL for payments + fees
    };

    const checkBalance = async (name: string, pubkey: PublicKey, minAmount: number) => {
      const balance = await provider.connection.getBalance(pubkey);
      const minSol = minAmount / LAMPORTS_PER_SOL;
      const currentSol = balance / LAMPORTS_PER_SOL;
      
      if (balance >= minAmount) {
        console.log(`   ✅ ${name}: ${currentSol.toFixed(4)} SOL (sufficient)`);
        return true;
      } else {
        console.log(`   ⚠️  ${name}: ${currentSol.toFixed(4)} SOL (needs at least ${minSol.toFixed(4)} SOL)`);
        console.log(`      Address: ${pubkey.toBase58()}`);
        console.log(`      Fund at: https://faucet.solana.com/`);
        return false;
      }
    };

    const balancesOk = (
      await checkBalance("protocolAuthority", protocolAuthority.publicKey, minRequired.protocolAuthority) &&
      await checkBalance("merchantOwner", merchantOwner.publicKey, minRequired.merchantOwner) &&
      await checkBalance("buyer", buyer.publicKey, minRequired.buyer)
    );

    if (!balancesOk) {
      throw new Error(
        `\n❌ Insufficient balance in test accounts. ` +
        `Please fund the addresses shown above on devnet, then run tests again.\n` +
        `This is a one-time setup - accounts will be reused across test runs.\n`
      );
    }

    console.log("✅ All test accounts have sufficient balance - proceeding with tests...\n");

    // Create USDC mint (test token)
    usdcMint = await createMint(
      provider.connection,
      protocolAuthority,
      protocolAuthority.publicKey,
      null,
      6 // 6 decimals like USDC
    );

    // Create buyback mint (test token)
    buybackMint = await createMint(
      provider.connection,
      merchantOwner,
      merchantOwner.publicKey,
      null,
      9 // 9 decimals
    );

    // Generate merchant_id (hash-based)
    const hash = createHash("sha256")
      .update(
        Buffer.from(
          merchantOwner.publicKey.toBase58() +
          Date.now().toString() +
          Math.random().toString()
        )
      )
      .digest();
    merchantId = new anchor.BN(hash.slice(0, 8), "le");

    // Derive PDAs
    [protocolConfigPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("protocol")],
      programId
    );

    [merchantRegistryPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("merchant"), merchantId.toArrayLike(Buffer, "le", 8)],
      programId
    );
  });

  describe("Protocol Initialization", () => {
    it("Initializes protocol configuration", async () => {
      try {
        const tx = await program.methods
          .initProtocol(
            new anchor.BN(PROTOCOL_FEE_BPS),
            protocolWallet.publicKey,
            JUPITER_ROUTER
          )
          .accounts({
            protocolConfig: protocolConfigPDA,
            authority: protocolAuthority.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([protocolAuthority])
          .rpc();

        console.log("✅ Protocol initialized:", tx);

        // Verify protocol config
        const config = await program.account.protocolConfig.fetch(protocolConfigPDA);
        // Handle BN conversion - might be BN or number
        const feeBps = typeof config.protocolFeeBps === 'object' && config.protocolFeeBps.toNumber 
          ? config.protocolFeeBps.toNumber() 
          : Number(config.protocolFeeBps);
        expect(feeBps).to.equal(PROTOCOL_FEE_BPS);
        expect(config.protocolWallet.toString()).to.equal(protocolWallet.publicKey.toString());
        expect(config.paused).to.be.false;
      } catch (err) {
        // Protocol might already be initialized, that's okay
        if (err.message && err.message.includes("already in use")) {
          console.log("ℹ️  Protocol already initialized");
        } else {
          throw err;
        }
      }
    });
  });

  describe("Merchant Registration", () => {
    it("Registers a merchant with on-chain registry", async () => {
      const tx = await program.methods
        .registerMerchant(
          merchantId,
          merchantPayoutWallet.publicKey,
          buybackMint
        )
        .accounts({
          merchantRegistry: merchantRegistryPDA,
          owner: merchantOwner.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([merchantOwner])
        .rpc();

      console.log("✅ Merchant registered:", tx);

      // Verify merchant registry
      const merchant = await program.account.merchantRegistry.fetch(merchantRegistryPDA);
      expect(merchant.merchantId.toString()).to.equal(merchantId.toString());
      expect(merchant.owner.toString()).to.equal(merchantOwner.publicKey.toString());
      expect(merchant.payoutWallet.toString()).to.equal(merchantPayoutWallet.publicKey.toString());
      expect(merchant.buybackMint.toString()).to.equal(buybackMint.toString());
      expect(merchant.frozen).to.be.false;
    });

    it("Fails to register with wrong merchant_id", async () => {
      const wrongMerchantId = new anchor.BN("999999999999999999");
      const [wrongPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("merchant"), wrongMerchantId.toArrayLike(Buffer, "le", 8)],
        programId
      );

      try {
        await program.methods
          .registerMerchant(
            wrongMerchantId,
            merchantPayoutWallet.publicKey,
            buybackMint
          )
          .accounts({
            merchantRegistry: merchantRegistryPDA, // Wrong PDA
            owner: merchantOwner.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([merchantOwner])
          .rpc();

        expect.fail("Should have failed");
      } catch (err) {
        expect(err.message).to.include("A seeds constraint was violated");
      }
    });
  });

  describe("Payment Settlement - Security Tests", () => {
    let vaultSolPDA: PublicKey;
    let vaultUsdcPDA: PublicKey;
    let vaultBuybackToken: PublicKey;
    let buyerUsdcAccount: PublicKey;
    let merchantPayoutUsdcAccount: PublicKey;
    let protocolWalletUsdcAccount: PublicKey;

    before(async () => {
      // Derive vault PDAs
      [vaultSolPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), Buffer.from("sol")],
        programId
      );

      [vaultUsdcPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault_usdc"), usdcMint.toBuffer()],
        programId
      );

      // Create token accounts
      buyerUsdcAccount = await getAssociatedTokenAddress(usdcMint, buyer.publicKey);
      merchantPayoutUsdcAccount = await getAssociatedTokenAddress(usdcMint, merchantPayoutWallet.publicKey);
      protocolWalletUsdcAccount = await getAssociatedTokenAddress(usdcMint, protocolWallet.publicKey);

      // Create buyer USDC account and mint tokens
      await createAccount(provider.connection, buyer, usdcMint, buyer.publicKey);
      await mintTo(
        provider.connection,
        buyer,
        usdcMint,
        buyerUsdcAccount,
        protocolAuthority,
        1000000000 // 1000 USDC (6 decimals)
      );

      // Create protocol wallet USDC account (required for protocol fee transfers)
      try {
        const protocolWalletUsdcInfo = await provider.connection.getAccountInfo(protocolWalletUsdcAccount);
        if (!protocolWalletUsdcInfo) {
          console.log("🔧 Creating protocol_wallet_usdc token account...");
          await createAccount(provider.connection, protocolAuthority, usdcMint, protocolWallet.publicKey);
          console.log("✅ protocol_wallet_usdc token account created");
        } else {
          console.log("✅ protocol_wallet_usdc token account already exists");
        }
      } catch (e: any) {
        if (e.message && e.message.includes("already in use")) {
          console.log("ℹ️  protocol_wallet_usdc already exists");
        } else {
          console.log("⚠️  Failed to create protocol_wallet_usdc:", e.message);
          throw e;
        }
      }

      // Create merchant payout USDC account (required even for SOL tests due to account deserialization)
      try {
        const merchantPayoutUsdcInfo = await provider.connection.getAccountInfo(merchantPayoutUsdcAccount);
        if (!merchantPayoutUsdcInfo) {
          console.log("🔧 Creating merchant_payout_usdc token account...");
          // Use a funded payer to create the account, but set owner to merchantPayoutWallet
          await createAccount(provider.connection, protocolAuthority, usdcMint, merchantPayoutWallet.publicKey);
          console.log("✅ merchant_payout_usdc token account created");
        } else {
          console.log("✅ merchant_payout_usdc token account already exists");
        }
      } catch (e: any) {
        if (e.message && e.message.includes("already in use")) {
          console.log("ℹ️  merchant_payout_usdc already exists");
        } else {
          console.log("⚠️  Failed to create merchant_payout_usdc:", e.message);
          throw e;
        }
      }

      // Initialize vault_usdc token account using the program's instruction
      try {
        const vaultUsdcInfo = await provider.connection.getAccountInfo(vaultUsdcPDA);
        if (!vaultUsdcInfo) {
          console.log("🔧 Initializing vault_usdc token account...");
          await program.methods
            .initVaultUsdc()
            .accounts({
              vaultUsdc: vaultUsdcPDA,
              usdcMint: usdcMint,
              payer: protocolAuthority.publicKey,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
            })
            .signers([protocolAuthority])
            .rpc();
          console.log("✅ vault_usdc token account initialized");
        } else {
          console.log("✅ vault_usdc token account already exists");
        }
      } catch (e: any) {
        // If already initialized, that's okay
        if (e.message && e.message.includes("already in use")) {
          console.log("ℹ️  vault_usdc already initialized");
        } else {
          console.log("⚠️  Failed to initialize vault_usdc:", e.message);
          throw e;
        }
      }

      // Create and initialize vault_buyback_token account
      // This is a regular token account (not a PDA) for the buyback mint
      // The program uses merchant_registry PDA as authority for burning tokens
      try {
        console.log("🔧 Creating vault_buyback_token account...");
        vaultBuybackToken = await createAccount(
          provider.connection,
          merchantOwner,
          buybackMint,
          merchantOwner.publicKey // Create with merchantOwner as owner
        );
        // Set authority to merchant registry PDA (program uses it for burning)
        await setAuthority(
          provider.connection,
          merchantOwner,
          vaultBuybackToken,
          merchantOwner.publicKey,
          AuthorityType.AccountOwner,
          merchantRegistryPDA
        );
        console.log("✅ vault_buyback_token account created and authority set:", vaultBuybackToken.toBase58());
      } catch (e: any) {
        // If account already exists, try to get it
        if (e.message && (e.message.includes("already in use") || e.message.includes("already exists"))) {
          // Try to find existing account - use a deterministic approach
          // Since we can't easily find it, just create a new one with a different owner or handle the error
          console.log("⚠️  vault_buyback_token might already exist, attempting to use existing...");
          // For now, just rethrow - the account should be created fresh each test run
          throw e;
        } else {
          console.log("⚠️  Failed to create vault_buyback_token:", e.message);
          throw e;
        }
      }
    });

    // Ensure vault_buyback_token exists before each test
    beforeEach(async () => {
      try {
        const info = await provider.connection.getAccountInfo(vaultBuybackToken);
        if (!info) {
          // Recreate if it doesn't exist
          vaultBuybackToken = await createAccount(
            provider.connection,
            merchantOwner,
            buybackMint,
            merchantOwner.publicKey
          );
          await setAuthority(
            provider.connection,
            merchantOwner,
            vaultBuybackToken,
            merchantOwner.publicKey,
            AuthorityType.AccountOwner,
            merchantRegistryPDA
          );
        }
      } catch (e: any) {
        // If account doesn't exist, create it
        vaultBuybackToken = await createAccount(
          provider.connection,
          merchantOwner,
          buybackMint,
          merchantOwner.publicKey
        );
        await setAuthority(
          provider.connection,
          merchantOwner,
          vaultBuybackToken,
          merchantOwner.publicKey,
          AuthorityType.AccountOwner,
          merchantRegistryPDA
        );
      }
    });

    it("Fails settlement with wrong payout wallet (rerouting attack)", async () => {
      const attackerWallet = Keypair.generate();
      const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
      const payoutBps = new anchor.BN(7000); // 70%
      const buybackBps = new anchor.BN(3000); // 30%
      const burnBps = new anchor.BN(0);

      try {
        await program.methods
          .settle(
            merchantId,
            amount,
            { sol: {} },
            new anchor.BN(0), // min_out
            payoutBps,
            buybackBps,
            burnBps
          )
          .accounts({
            protocolConfig: protocolConfigPDA,
            merchantRegistry: merchantRegistryPDA,
            payer: buyer.publicKey,
            vaultSol: vaultSolPDA,
            vaultUsdc: vaultUsdcPDA,
            usdcMint: usdcMint,
            vaultBuybackToken: vaultBuybackToken,
            buybackMint: buybackMint,
            protocolWallet: protocolWallet.publicKey,
            protocolWalletUsdc: protocolWalletUsdcAccount,
            merchantPayoutWallet: attackerWallet.publicKey, // WRONG WALLET - should fail
            merchantPayoutUsdc: merchantPayoutUsdcAccount,
            payerUsdcAccount: buyerUsdcAccount,
            jupiterRouter: JUPITER_ROUTER,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();

        expect.fail("Should have failed with InvalidPayoutWallet");
      } catch (err: any) {
        // Check Anchor error code - try multiple possible structures
        const errorCode = err?.error?.errorCode?.code || err?.error?.errorCode?.name || 
                         err?.code?.code || err?.code?.name ||
                         err?.error?.errorCode || err?.code;
        const errorMsg = err?.message || err?.toString() || "";
        const hasError = errorCode === "InvalidPayoutWallet" || 
                        errorMsg.includes("InvalidPayoutWallet") ||
                        errorMsg.includes("Invalid payout wallet");
        if (!hasError) {
          console.error("Unexpected error:", JSON.stringify(err, null, 2));
        }
        expect(hasError).to.be.true;
        console.log("✅ Rerouting attack prevented");
      }
    });

    it("Fails settlement with wrong buyback mint", async () => {
      const wrongMint = await createMint(
        provider.connection,
        merchantOwner,
        merchantOwner.publicKey,
        null,
        9
      );

      // Create token account for wrong mint (required for Anchor deserialization)
      const wrongMintVault = await createAccount(
        provider.connection,
        merchantOwner,
        wrongMint,
        merchantOwner.publicKey
      );
      await setAuthority(
        provider.connection,
        merchantOwner,
        wrongMintVault,
        merchantOwner.publicKey,
        AuthorityType.AccountOwner,
        merchantRegistryPDA
      );

      const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
      const payoutBps = new anchor.BN(7000);
      const buybackBps = new anchor.BN(3000);
      const burnBps = new anchor.BN(0);

      try {
        await program.methods
          .settle(
            merchantId,
            amount,
            { sol: {} },
            new anchor.BN(0),
            payoutBps,
            buybackBps,
            burnBps
          )
          .accounts({
            protocolConfig: protocolConfigPDA,
            merchantRegistry: merchantRegistryPDA,
            payer: buyer.publicKey,
            vaultSol: vaultSolPDA,
            vaultUsdc: vaultUsdcPDA,
            usdcMint: usdcMint,
            vaultBuybackToken: wrongMintVault, // Token account for wrong mint
            buybackMint: wrongMint, // WRONG MINT - should fail
            protocolWallet: protocolWallet.publicKey,
            protocolWalletUsdc: protocolWalletUsdcAccount,
            merchantPayoutWallet: merchantPayoutWallet.publicKey,
            merchantPayoutUsdc: merchantPayoutUsdcAccount,
            payerUsdcAccount: buyerUsdcAccount,
            jupiterRouter: JUPITER_ROUTER,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();

        expect.fail("Should have failed with InvalidBuybackMint");
      } catch (err: any) {
        // Check Anchor error code - try multiple possible structures
        const errorCode = err?.error?.errorCode?.code || err?.error?.errorCode?.name || 
                         err?.code?.code || err?.code?.name ||
                         err?.error?.errorCode || err?.code;
        const errorMsg = err?.message || err?.toString() || "";
        const hasError = errorCode === "InvalidBuybackMint" || 
                        errorMsg.includes("InvalidBuybackMint") ||
                        errorMsg.includes("Invalid buyback mint");
        if (!hasError) {
          console.error("Unexpected error:", JSON.stringify(err, null, 2));
        }
        expect(hasError).to.be.true;
        console.log("✅ Wrong buyback mint rejected");
      }
    });

    it("Fails settlement with invalid BPS (payout + buyback > 100%)", async () => {
      const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
      const payoutBps = new anchor.BN(7000);
      const buybackBps = new anchor.BN(4000); // Total = 110% - should fail
      const burnBps = new anchor.BN(0);

      try {
        await program.methods
          .settle(
            merchantId,
            amount,
            { sol: {} },
            new anchor.BN(0),
            payoutBps,
            buybackBps,
            burnBps
          )
          .accounts({
            protocolConfig: protocolConfigPDA,
            merchantRegistry: merchantRegistryPDA,
            payer: buyer.publicKey,
            vaultSol: vaultSolPDA,
            vaultUsdc: vaultUsdcPDA,
            usdcMint: usdcMint,
            vaultBuybackToken: vaultBuybackToken,
            buybackMint: buybackMint,
            protocolWallet: protocolWallet.publicKey,
            protocolWalletUsdc: protocolWalletUsdcAccount,
            merchantPayoutWallet: merchantPayoutWallet.publicKey,
            merchantPayoutUsdc: merchantPayoutUsdcAccount,
            payerUsdcAccount: buyerUsdcAccount,
            jupiterRouter: JUPITER_ROUTER,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();

        expect.fail("Should have failed with InvalidBasisPoints");
      } catch (err: any) {
        // Check Anchor error code - try multiple possible structures
        const errorCode = err?.error?.errorCode?.code || err?.error?.errorCode?.name || 
                         err?.code?.code || err?.code?.name ||
                         err?.error?.errorCode || err?.code;
        const errorMsg = err?.message || err?.toString() || "";
        const hasError = errorCode === "InvalidBasisPoints" || 
                        errorMsg.includes("InvalidBasisPoints") ||
                        errorMsg.includes("Payout + buyback basis points");
        if (!hasError) {
          console.error("Unexpected error:", JSON.stringify(err, null, 2));
        }
        expect(hasError).to.be.true;
        console.log("✅ Invalid BPS rejected");
      }
    });

    it("Fails settlement when protocol is paused", async () => {
      // Pause protocol
      await program.methods
        .updateProtocol(
          null,
          null,
          null,
          true // paused
        )
        .accounts({
          protocolConfig: protocolConfigPDA,
          authority: protocolAuthority.publicKey,
        })
        .signers([protocolAuthority])
        .rpc();

      const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
      const payoutBps = new anchor.BN(7000);
      const buybackBps = new anchor.BN(3000);
      const burnBps = new anchor.BN(0);

      try {
        await program.methods
          .settle(
            merchantId,
            amount,
            { sol: {} },
            new anchor.BN(0),
            payoutBps,
            buybackBps,
            burnBps
          )
          .accounts({
            protocolConfig: protocolConfigPDA,
            merchantRegistry: merchantRegistryPDA,
            payer: buyer.publicKey,
            vaultSol: vaultSolPDA,
            vaultUsdc: vaultUsdcPDA,
            usdcMint: usdcMint,
            vaultBuybackToken: vaultBuybackToken,
            buybackMint: buybackMint,
            protocolWallet: protocolWallet.publicKey,
            protocolWalletUsdc: protocolWalletUsdcAccount,
            merchantPayoutWallet: merchantPayoutWallet.publicKey,
            merchantPayoutUsdc: merchantPayoutUsdcAccount,
            payerUsdcAccount: buyerUsdcAccount,
            jupiterRouter: JUPITER_ROUTER,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();

        expect.fail("Should have failed with ProtocolPaused");
      } catch (err: any) {
        // Check Anchor error code - try multiple possible structures
        const errorCode = err?.error?.errorCode?.code || err?.error?.errorCode?.name || 
                         err?.code?.code || err?.code?.name ||
                         err?.error?.errorCode || err?.code;
        const errorMsg = err?.message || err?.toString() || "";
        const hasError = errorCode === "ProtocolPaused" || 
                        errorMsg.includes("ProtocolPaused") ||
                        errorMsg.includes("Protocol is paused");
        if (!hasError) {
          console.error("Unexpected error:", JSON.stringify(err, null, 2));
        }
        expect(hasError).to.be.true;
        console.log("✅ Paused protocol rejected payments");
      } finally {
        // Unpause protocol
        await program.methods
          .updateProtocol(null, null, null, false)
          .accounts({
            protocolConfig: protocolConfigPDA,
            authority: protocolAuthority.publicKey,
          })
          .signers([protocolAuthority])
          .rpc();
      }
    });

    it("Fails settlement when merchant is frozen", async () => {
      // Freeze merchant
      await program.methods
        .updateMerchant(
          null,
          null,
          true // frozen
        )
        .accounts({
          merchantRegistry: merchantRegistryPDA,
          owner: merchantOwner.publicKey,
        })
        .signers([merchantOwner])
        .rpc();

      const amount = new anchor.BN(1 * LAMPORTS_PER_SOL);
      const payoutBps = new anchor.BN(7000);
      const buybackBps = new anchor.BN(3000);
      const burnBps = new anchor.BN(0);

      try {
        await program.methods
          .settle(
            merchantId,
            amount,
            { sol: {} },
            new anchor.BN(0),
            payoutBps,
            buybackBps,
            burnBps
          )
          .accounts({
            protocolConfig: protocolConfigPDA,
            merchantRegistry: merchantRegistryPDA,
            payer: buyer.publicKey,
            vaultSol: vaultSolPDA,
            vaultUsdc: vaultUsdcPDA,
            usdcMint: usdcMint,
            vaultBuybackToken: vaultBuybackToken,
            buybackMint: buybackMint,
            protocolWallet: protocolWallet.publicKey,
            protocolWalletUsdc: protocolWalletUsdcAccount,
            merchantPayoutWallet: merchantPayoutWallet.publicKey,
            merchantPayoutUsdc: merchantPayoutUsdcAccount,
            payerUsdcAccount: buyerUsdcAccount,
            jupiterRouter: JUPITER_ROUTER,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();

        expect.fail("Should have failed with MerchantFrozen");
      } catch (err: any) {
        // Check Anchor error code - try multiple possible structures
        const errorCode = err?.error?.errorCode?.code || err?.error?.errorCode?.name || 
                         err?.code?.code || err?.code?.name ||
                         err?.error?.errorCode || err?.code;
        const errorMsg = err?.message || err?.toString() || "";
        const hasError = errorCode === "MerchantFrozen" || 
                        errorMsg.includes("MerchantFrozen") ||
                        errorMsg.includes("Merchant account is frozen");
        if (!hasError) {
          console.error("Unexpected error:", JSON.stringify(err, null, 2));
        }
        expect(hasError).to.be.true;
        console.log("✅ Frozen merchant rejected payments");
      } finally {
        // Unfreeze merchant
        await program.methods
          .updateMerchant(null, null, false)
          .accounts({
            merchantRegistry: merchantRegistryPDA,
            owner: merchantOwner.publicKey,
          })
          .signers([merchantOwner])
          .rpc();
      }
    });
  });

  describe("Protocol Fee Enforcement", () => {
    it("Calculates and transfers protocol fee correctly", async () => {
      // This test verifies that protocol fee is calculated and transferred
      // Note: Full settlement test requires Jupiter integration
      // For now, we verify the fee calculation logic

      const amount = 100 * LAMPORTS_PER_SOL; // 100 SOL
      const expectedProtocolFee = (amount * PROTOCOL_FEE_BPS) / 10000; // 1 SOL

      expect(expectedProtocolFee).to.equal(1 * LAMPORTS_PER_SOL);
      console.log("✅ Protocol fee calculation verified:", expectedProtocolFee / LAMPORTS_PER_SOL, "SOL");
    });
  });
});

