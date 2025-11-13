#!/bin/bash
# Manually generate IDL from compiled program

set -e

cd "$(dirname "$0")/.."

echo "📝 Generating IDL manually..."

# Ensure directories exist
mkdir -p target/idl
mkdir -p target/types

# Check if program was built
if [ ! -f "target/deploy/qantara.so" ]; then
    echo "❌ Program not built. Run 'anchor build' first."
    exit 1
fi

# Get program ID from Anchor.toml or keypair
if [ -f "target/deploy/qantara-keypair.json" ]; then
    PROGRAM_ID=$(solana-keygen pubkey target/deploy/qantara-keypair.json)
else
    # Try to get from Anchor.toml
    PROGRAM_ID=$(grep -A 1 "\[programs.devnet\]" Anchor.toml | grep "qantara" | cut -d'"' -f2)
fi

if [ -z "$PROGRAM_ID" ]; then
    echo "❌ Could not determine program ID"
    exit 1
fi

echo "Program ID: $PROGRAM_ID"

# Create a basic IDL structure
# Note: This is a fallback - ideally anchor build should generate it
cat > target/idl/qantara.json << EOF
{
  "version": "0.1.0",
  "name": "qantara",
  "metadata": {
    "address": "$PROGRAM_ID"
  },
  "instructions": [
    {
      "name": "initMerchant",
      "accounts": [
        {
          "name": "merchantConfig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": "InitMerchantArgs"
          }
        }
      ]
    },
    {
      "name": "updateMerchant",
      "accounts": [
        {
          "name": "merchantConfig",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": false,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": "UpdateMerchantArgs"
          }
        }
      ]
    },
    {
      "name": "settle",
      "accounts": [
        {
          "name": "merchantConfig",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "vaultSol",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "vaultUsdc",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "usdcMint",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "vaultBuybackToken",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "buybackMintAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payoutWalletSol",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payoutWalletUsdc",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payerUsdcAccount",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "routerProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "tokenProgram",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "payToken",
          "type": {
            "defined": "PayToken"
          }
        },
        {
          "name": "minOut",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "MerchantConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "publicKey"
          },
          {
            "name": "payoutWallet",
            "type": "publicKey"
          },
          {
            "name": "allowSol",
            "type": "bool"
          },
          {
            "name": "allowUsdc",
            "type": "bool"
          },
          {
            "name": "buybackMint",
            "type": "publicKey"
          },
          {
            "name": "payoutBps",
            "type": "u16"
          },
          {
            "name": "buybackBps",
            "type": "u16"
          },
          {
            "name": "burnOfBuybackBps",
            "type": "u16"
          },
          {
            "name": "slippageBpsMax",
            "type": "u16"
          },
          {
            "name": "routerProgram",
            "type": "publicKey"
          },
          {
            "name": "frozen",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ],
  "types": [
    {
      "name": "InitMerchantArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payoutWallet",
            "type": "publicKey"
          },
          {
            "name": "allowSol",
            "type": "bool"
          },
          {
            "name": "allowUsdc",
            "type": "bool"
          },
          {
            "name": "buybackMint",
            "type": "publicKey"
          },
          {
            "name": "payoutBps",
            "type": "u16"
          },
          {
            "name": "buybackBps",
            "type": "u16"
          },
          {
            "name": "burnOfBuybackBps",
            "type": "u16"
          },
          {
            "name": "slippageBpsMax",
            "type": "u16"
          },
          {
            "name": "routerProgram",
            "type": "publicKey"
          }
        ]
      }
    },
    {
      "name": "UpdateMerchantArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "payoutBps",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "buybackBps",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "burnOfBuybackBps",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "slippageBpsMax",
            "type": {
              "option": "u16"
            }
          },
          {
            "name": "frozen",
            "type": {
              "option": "bool"
            }
          }
        ]
      }
    },
    {
      "name": "PayToken",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Sol"
          },
          {
            "name": "Usdc"
          }
        ]
      }
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidBasisPoints",
      "msg": "Payout + buyback basis points exceed 10000"
    },
    {
      "code": 6001,
      "name": "SlippageTooHigh",
      "msg": "Slippage tolerance exceeds maximum (1000 bps)"
    },
    {
      "code": 6002,
      "name": "MerchantFrozen",
      "msg": "Merchant account is frozen"
    },
    {
      "code": 6003,
      "name": "PayTokenNotAllowed",
      "msg": "Payment token not allowed by merchant"
    },
    {
      "code": 6004,
      "name": "InvalidRouterProgram",
      "msg": "Router program does not match config"
    },
    {
      "code": 6005,
      "name": "SlippageExceeded",
      "msg": "Swap output below minimum (slippage exceeded)"
    }
  ]
}
EOF

echo "✅ IDL generated at target/idl/qantara.json"

