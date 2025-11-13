import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, Idl } from '@coral-xyz/anchor';
import { readFileSync } from 'fs';
import { join } from 'path';
import { QANTARA_V2_PROGRAM_ID } from './pda';

let cachedProgram: Program<Idl> | null = null;
let cachedIdl: Idl | null = null;

/**
 * Normalize IDL for anchor-js compatibility
 * Fixes issues with account types and defined types
 */
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
      if (Array.isArray(ix.args)) {
        ix.args.forEach((arg: any) => {
          fixDefined(arg);
          // Ensure type is an object if it's a string (for Anchor compatibility)
          if (arg.type && typeof arg.type === 'string') {
            // Keep as string - Anchor should handle this, but if not, we might need to convert
            // For now, leave as string since that's the IDL format
          }
        });
      }
      if (Array.isArray(ix.accounts)) {
        ix.accounts.forEach(fixDefined);
      }
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

  return idl;
}

/**
 * Load V2 IDL from file
 */
export function loadV2Idl(): Idl {
  if (cachedIdl) {
    return cachedIdl;
  }

  // Try multiple possible IDL locations
  // Note: __dirname in compiled JS will be in dist/services, so we need to go up more levels
  const possibleIdlPaths = [
    // From compiled dist/services: ../../../../contracts/target/idl/qantara_v2.json
    join(__dirname, '../../../../contracts/target/idl/qantara_v2.json'),
    // From source src/services: ../../../contracts/target/idl/qantara_v2.json
    join(__dirname, '../../../contracts/target/idl/qantara_v2.json'),
    // From workspace root: contracts/target/idl/qantara_v2.json
    join(process.cwd(), 'contracts/target/idl/qantara_v2.json'),
    // From apps/api-server: ../contracts/target/idl/qantara_v2.json
    join(process.cwd(), '../contracts/target/idl/qantara_v2.json'),
    // From apps/api-server: ../../contracts/target/idl/qantara_v2.json
    join(process.cwd(), '../../contracts/target/idl/qantara_v2.json'),
    // Absolute path from workspace root (if running from apps/api-server)
    join(process.cwd().replace(/\/apps\/api-server.*$/, ''), 'contracts/target/idl/qantara_v2.json'),
    // Environment variable override
    process.env.IDL_PATH || '',
  ].filter(Boolean);

  for (const idlPath of possibleIdlPaths) {
    try {
      const idlContent = readFileSync(idlPath, 'utf8');
      const rawIdl = JSON.parse(idlContent);
      // Normalize IDL for anchor-js compatibility
      const normalizedIdl = normalizeIdl(rawIdl);
      cachedIdl = normalizedIdl;
      console.log(`✅ Loaded V2 IDL from: ${idlPath}`);
      return normalizedIdl;
    } catch (e) {
      // Continue to next path
    }
  }

  throw new Error(
    `V2 IDL not found. Tried: ${possibleIdlPaths.join(', ')}\n` +
    `Set IDL_PATH environment variable or ensure IDL is at one of the expected locations.`
  );
}

/**
 * Get or create Anchor program instance
 */
export function getProgram(connection: Connection): Program<Idl> {
  if (cachedProgram) {
    return cachedProgram;
  }

  const idl = loadV2Idl();
  
  // Create a dummy wallet for provider (we don't need it for read operations)
  // For write operations, the caller should provide the actual wallet
  const dummyWallet = {
    publicKey: PublicKey.default,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs,
  } as Wallet;

  const provider = new AnchorProvider(
    connection,
    dummyWallet,
    { commitment: 'confirmed' }
  );

  cachedProgram = new Program(idl, QANTARA_V2_PROGRAM_ID, provider);
  return cachedProgram;
}

/**
 * Create program with custom provider
 */
export function createProgramWithProvider(
  provider: AnchorProvider
): Program<Idl> {
  const idl = loadV2Idl();
  return new Program(idl, QANTARA_V2_PROGRAM_ID, provider);
}

/**
 * Get program ID
 */
export function getProgramId(): PublicKey {
  return QANTARA_V2_PROGRAM_ID;
}

