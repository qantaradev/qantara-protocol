# Contributing to Qantara

Thank you for your interest in contributing to Qantara! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different viewpoints and experiences

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/your-org/qantara/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)
   - Relevant logs or screenshots

### Suggesting Features

1. Check existing [Discussions](https://github.com/your-org/qantara/discussions) for similar ideas
2. Create a new discussion or issue with:
   - Clear description of the feature
   - Use case and motivation
   - Proposed implementation (if any)
   - Examples or mockups

### Pull Requests

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**:
   - Follow code style guidelines
   - Add tests for new features
   - Update documentation
   - Ensure all tests pass
4. **Commit your changes**: `git commit -m 'Add amazing feature'`
   - Use clear, descriptive commit messages
   - Reference issues if applicable
5. **Push to your fork**: `git push origin feature/amazing-feature`
6. **Open a Pull Request**:
   - Clear title and description
   - Reference related issues
   - Request review from maintainers

## Development Setup

### Prerequisites

- Rust 1.70+
- Anchor 0.29+
- Node.js 18+
- PostgreSQL 15+
- Solana CLI 1.18+

### Setup

```bash
# Clone your fork
git clone https://github.com/your-username/qantara.git
cd qantara

# Add upstream remote
git remote add upstream https://github.com/your-org/qantara.git

# Install dependencies
pnpm install

# Build contracts
cd contracts
anchor build

# Run tests
anchor test
```

## Code Style

### Rust (Smart Contracts)

- Follow [Rust Style Guide](https://doc.rust-lang.org/1.0.0/style-guide.html)
- Use `cargo fmt` for formatting
- Use `cargo clippy` for linting
- Maximum line length: 100 characters

### TypeScript (API Server)

- Follow [TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- Use `prettier` for formatting
- Use `eslint` for linting
- Maximum line length: 100 characters

### General

- Write clear, self-documenting code
- Add comments for complex logic
- Use meaningful variable and function names
- Keep functions small and focused

## Testing

### Smart Contracts

```bash
cd contracts
anchor test
```

- All new instructions must have tests
- Test both success and failure cases
- Test security validations
- Aim for >80% code coverage

### API Server

```bash
cd apps/api-server
npm test
```

- Unit tests for all services
- Integration tests for endpoints
- Test error handling
- Test edge cases

## Documentation

- Update README.md for user-facing changes
- Add code comments for complex logic
- Update API documentation for endpoint changes
- Add examples for new features

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body (optional)

footer (optional)
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Maintenance tasks

Examples:
```
feat(api): add merchant registration endpoint
fix(contract): prevent BPS overflow attack
docs(readme): update installation instructions
```

## Pull Request Process

1. **Ensure tests pass**: All tests must pass
2. **Update documentation**: Update relevant docs
3. **Request review**: Request review from maintainers
4. **Address feedback**: Respond to review comments
5. **Squash commits**: Maintainers may ask to squash commits

## Review Guidelines

### For Contributors

- Be open to feedback
- Respond to comments promptly
- Make requested changes
- Ask questions if unclear

### For Reviewers

- Be constructive and respectful
- Explain reasoning for suggestions
- Approve when ready
- Request changes when needed

## Areas for Contribution

### High Priority

- Security improvements
- Performance optimizations
- Test coverage
- Documentation improvements

### Medium Priority

- New features
- UI/UX improvements
- Developer experience
- Error handling

### Low Priority

- Code style improvements
- Refactoring
- Documentation updates
- Examples and tutorials

## Questions?

- Open a [Discussion](https://github.com/your-org/qantara/discussions)
- Check [Documentation](./docs/)
- Review [Issues](https://github.com/your-org/qantara/issues)

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.

---

**Thank you for contributing to Qantara!** 🎉

