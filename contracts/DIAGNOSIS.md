# Diagnosis: V2 Test Failure

## Current Error

```
TypeError: Cannot read properties of undefined (reading 'size')
at new AccountClient
```

## Root Cause

Anchor CLI 0.31.1 generates IDL with:
- `accounts` array: Only has `name` and `discriminator` (no `type` or `size`)
- `types` array: Has full struct definitions with `name` and `type`

anchor-js 0.31.1 expects:
- Each account in `accounts` array to have `type` property pointing to struct definition
- Each account to have `size` property

## What We've Tried

1. ✅ Upgraded anchor-js from 0.29.0 to 0.31.1
2. ✅ Added IDL normalization to inject `type` from `types` array
3. ✅ Added size calculation from struct definitions
4. ❌ Still failing - account.type or account.size is still undefined

## Current Status

The normalization function:
- Maps types from `types` array to `typeMap`
- Tries to attach `type` to accounts
- Calculates `size` from struct fields
- But something is still undefined when `new Program()` is called

## Next Steps

1. Add debug logging to see what's actually in the IDL after normalization
2. Verify the type mapping is working correctly
3. Ensure size calculation handles all field types correctly
4. Check if anchor-js expects a different IDL structure

## Files to Check

- `contracts/tests/v2/qantara-v2.spec.ts` - Normalization function
- `contracts/target/idl/qantara_v2.json` - Raw IDL from Anchor
- Check if account.type is being set correctly before Program creation

