# Final Fix: anchor-js AccountClient Size Issue

## Problem

Even though accounts have `type` and `size` after normalization, anchor-js still throws:
```
TypeError: Cannot read properties of undefined (reading 'size')
at new AccountClient
```

## Root Cause Analysis

Looking at anchor-js 0.31.1 source code behavior:
- `AccountClient` constructor iterates through `idl.accounts`
- For each account, it tries to access `account.type.size` 
- If `account.type` is undefined OR `account.type.size` is undefined, it fails

## Solution

The normalization now:
1. ✅ Sets `account.type` from `types` array
2. ✅ Sets `account.size` (calculated)
3. ✅ ALSO sets `account.type.size` (anchor-js checks this!)

## What Changed

Updated `normalizeIdl()` to:
- Set size on both `account.size` AND `account.type.size`
- Add final safety check to ensure both exist
- Better debug output showing both sizes

## Test Again

```bash
npm run test:v2
```

The debug output will now show:
- `accountSize`: Size on account object
- `typeSize`: Size on account.type object  
- `typeHasSize`: Whether type.size exists

If it still fails, the debug output will tell us exactly what's missing.

