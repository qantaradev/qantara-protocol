# Qantara Protocol

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Solana](https://img.shields.io/badge/Solana-Web3-orange)](https://solana.com)
[![Anchor](https://img.shields.io/badge/Anchor-0.29+-purple)](https://www.anchor-lang.com)

> **An open-source Web3 payment protocol for Solana that enables merchants to accept payments with automatic buyback-and-burn mechanisms for community tokens.**

## 🎯 What is Qantara?

Qantara is a **crypto-native payment protocol** that executes three atomic actions in a single transaction:

1. **Merchant Payout** - Direct transfer to merchant wallet
2. **Token Buyback** - Automatic swap via Jupiter aggregator  
3. **Protocol-Enforced Burn** - Deflationary tokenomics support

Every payment automatically supports the merchant's community token through transparent, on-chain buyback and burn operations.

## ✨ Key Features

- 🔒 **Secure**: 8 comprehensive security validations prevent attacks
- ⚡ **Fast**: Single atomic transaction for payment, buyback, and burn
- 🌐 **Crypto-Native**: 100% on-chain, fully verifiable
- 🔄 **Automatic**: Jupiter integration for optimal swap routes
- 📊 **Transparent**: All operations on-chain, fully auditable
- 🛡️ **Battle-tested**: Comprehensive test suite covering all security scenarios

## 🚀 Quick Start

### Prerequisites

- **Rust** 1.70+
- **Anchor** 0.29+
- **Node.js** 18+
- **Solana CLI** 1.18+

### Installation

```bash
# Clone the repository
git clone https://github.com/qantaradev/qantara-protocol
cd qantara-protocol

# Install dependencies
pnpm install

# Build smart contract
cd contracts
anchor build

# Run tests
anchor test
```

## 📖 Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) directory:

### Getting Started
- **[Installation Guide](./docs/getting-started/installation.md)** - Complete setup instructions
- **[Quick Start Guide](./docs/getting-started/quickstart.md)** - Get your first payment working in minutes

### Architecture
- **[Architecture Overview](./docs/architecture/overview.md)** - System design and components
- **[Vault Architecture](./docs/architecture/vault-architecture.md)** - Detailed vault design
- **[Payment Flow](./docs/architecture/payment-flow.md)** - Step-by-step payment process

### API Integration
- **[API Overview](./docs/api/overview.md)** - API introduction and quick start
- **[Merchant API](./docs/api/merchant-api.md)** - Merchant registration and management
- **[Payment API](./docs/api/payment-api.md)** - Payment quote and transaction building

### Security
- **[Security Overview](./docs/security/overview.md)** - Security architecture and best practices
- **[Security Validations](./docs/security/validations.md)** - Detailed validation documentation

### Development
- **[Smart Contract Development](./docs/development/smart-contracts.md)** - Building and contributing to contracts

### Integration
- **[Integration Examples](./docs/integration/examples.md)** - Real-world integration examples

### Contributing
- **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute to the project

## 🔐 Security

Qantara implements **8 comprehensive security validations**:

1. ✅ Protocol pause protection
2. ✅ Merchant ID validation
3. ✅ Merchant freeze protection
4. ✅ Payout wallet validation (prevents rerouting attacks)
5. ✅ Buyback mint validation (prevents wrong token attacks)
6. ✅ BPS bounds validation (prevents overflow)
7. ✅ Jupiter router allowlist
8. ✅ Slippage protection

See [Security Documentation](./docs/security/overview.md) for details.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](./LICENSE) file for details.

## 🔗 Links

- **Documentation**: [docs/](./docs/)
- **Smart Contract**: [contracts/](./contracts/)
- **API Server**: [apps/api-server/](./apps/api-server/)
- **Checkout UI**: [apps/checkout-ui/](./apps/checkout-ui/)
- **Issues**: [GitHub Issues](https://github.com/qantaradev/qantara-protocol/issues)
- **Discussions**: [GitHub Discussions](https://github.com/qantaradev/qantara-protocol/discussions)

---

**Built with ❤️ for the Solana ecosystem**

**Qantara Protocol** - Enabling crypto-native payments with automatic token buyback and burn.
