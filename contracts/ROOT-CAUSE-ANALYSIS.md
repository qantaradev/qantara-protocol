# Root Cause Analysis: Anchor Multi-Program Testing

## The Problem

When running `anchor test`, Anchor tries to:
1. Build all programs listed in `Anchor.toml`
2. Deploy ALL programs to the cluster
3. Run tests

**Issue**: V1 (`qantara`) binary exists but Anchor can't find it in the expected location, OR it's not built in release mode.

## Anchor's Expected Structure

```
contracts/
├── Anchor.toml          # Lists all programs
├── target/
│   ├── deploy/         # ALL program binaries here
│   │   ├── qantara.so
│   │   └── qantara-v2.so
│   └── idl/            # ALL IDLs here
│       ├── qantara.json
│       └── qantara_v2.json
└── programs/
    ├── qantara/
    └── qantara-v2/
```

## Current State

✅ V2 builds successfully
✅ V2 IDL generated: `target/idl/qantara_v2.json`
✅ V2 binary exists: `programs/qantara-v2/target/deploy/qantara_v2.so`
❌ Anchor expects: `target/deploy/qantara.so` (V1)
❌ Anchor expects: `target/deploy/qantara-v2.so` (V2)

## Solutions

### Solution 1: Direct TypeScript Testing (RECOMMENDED)

**Skip Anchor's test command entirely**. Use TypeScript tests directly:

```bash
# Build V2
anchor build --program-name qantara-v2

# Run TypeScript tests directly (no deployment needed)
npx ts-mocha -p ./tsconfig.json -t 1000000 tests/v2/**/*.ts
```

**Why this works:**
- Tests load IDL from `target/idl/qantara_v2.json`
- Tests use `anchor.workspace` which reads from IDL
- No deployment needed for testing
- Faster iteration

### Solution 2: Build Both Programs

Build V1 first, then V2:

```bash
anchor build --program-name qantara
anchor build --program-name qantara-v2
anchor test --skip-local-validator
```

### Solution 3: Separate Anchor Projects

Create separate projects for V1 and V2 (cleaner but more setup).

## Recommended Approach

**Use Solution 1** - Direct TypeScript testing:

1. Build once: `anchor build --program-name qantara-v2`
2. Test directly: `npx ts-mocha tests/v2/**/*.ts`
3. No deployment needed for unit/integration tests

This is actually the **standard approach** for Anchor projects - you don't need to deploy to test!

