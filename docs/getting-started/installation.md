# Installation Guide

This guide will help you set up the Qantara Protocol development environment.

## Prerequisites

Before installing Qantara Protocol, ensure you have the following installed:

### Required Software

- **Rust** 1.70 or higher
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```

- **Anchor Framework** 0.29 or higher
  ```bash
  cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
  avm install latest
  avm use latest
  ```

- **Node.js** 18 or higher
  - Download from [nodejs.org](https://nodejs.org/) or use a version manager like `nvm`

- **pnpm** (Package Manager)
  ```bash
  npm install -g pnpm
  ```

- **Solana CLI** 1.18 or higher
  ```bash
  sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
  ```

### Optional but Recommended

- **Git** - For version control
- **VS Code** with Rust and Anchor extensions
- **Solana Explorer** - For viewing on-chain data

## Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/qantaradev/qantara-protocol
cd qantara-protocol
```

### 2. Install Dependencies

Install all workspace dependencies:

```bash
pnpm install
```

This will install dependencies for:
- Root workspace
- API Server (`apps/api-server`)
- Checkout UI (`apps/checkout-ui`)
- Smart Contracts (`contracts`)

### 3. Build Smart Contracts

Navigate to the contracts directory and build:

```bash
cd contracts
anchor build
```

This will:
- Compile the Rust programs
- Generate TypeScript types
- Create the IDL (Interface Definition Language) files

### 4. Configure Environment

#### API Server Configuration

Copy the example environment file:

```bash
cd apps/api-server
cp env.example .env
```

Edit `.env` with your configuration:

```env
# RPC Configuration
RPC_URL=https://api.devnet.solana.com

# Network (devnet or mainnet)
NETWORK=devnet

# Service Wallet (for merchant registration)
SERVICE_WALLET_PRIVATE_KEY=your_base64_encoded_keypair

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# API Configuration
API_PORT=3001
NODE_ENV=development
```

#### Solana Configuration

Set your Solana CLI to the desired network:

```bash
# For devnet
solana config set --url devnet

# For mainnet (production)
solana config set --url mainnet-beta
```

### 5. Run Tests

Verify your installation by running tests:

```bash
# From contracts directory
anchor test

# Or run specific test suites
anchor test --skip-local-validator
```

### 6. Start Development Services

#### API Server

```bash
cd apps/api-server
pnpm dev
```

The API server will start on `http://localhost:3001` (or your configured port).

#### Checkout UI (Optional)

```bash
cd apps/checkout-ui
pnpm dev
```

The checkout UI will start on `http://localhost:3000`.

## Verification

### Check Anchor Installation

```bash
anchor --version
```

Should output: `anchor-cli 0.29.x` or higher

### Check Solana CLI

```bash
solana --version
```

Should output: `solana-cli 1.18.x` or higher

### Check Rust

```bash
rustc --version
```

Should output: `rustc 1.70.x` or higher

### Check Node.js

```bash
node --version
```

Should output: `v18.x.x` or higher

## Troubleshooting

### Common Issues

#### Anchor Build Fails

- Ensure Rust is up to date: `rustup update`
- Clear Anchor cache: `rm -rf ~/.anchor`
- Rebuild: `anchor clean && anchor build`

#### Solana CLI Not Found

- Add Solana to your PATH:
  ```bash
  export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
  ```

#### TypeScript Errors

- Clear node_modules and reinstall:
  ```bash
  rm -rf node_modules
  pnpm install
  ```

#### RPC Connection Issues

- Check your RPC URL is correct
- For devnet, use: `https://api.devnet.solana.com`
- Consider using a private RPC provider for better reliability

## Next Steps

Once installation is complete, proceed to:

- [Quick Start Guide](./quickstart.md) - Get your first payment working
- [Architecture Overview](../architecture/overview.md) - Understand the system design
- [API Integration](../api/overview.md) - Integrate Qantara into your application

## Additional Resources

- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Documentation](https://docs.solana.com/)
- [Jupiter API Documentation](https://docs.jup.ag/)

