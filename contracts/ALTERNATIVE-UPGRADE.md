# Alternative: Upgrade to Anchor 0.31.1

Since Anchor 0.29.0 installation is problematic, you can upgrade the project to use 0.31.1 which is already installed.

## Quick Upgrade Steps

1. Update `Anchor.toml`:
```toml
[toolchain]
anchor_version = "0.31.1"
```

2. Update `Cargo.toml` dependencies:
```toml
anchor-lang = "0.31.1"
anchor-spl = "0.31.1"
```

3. Update `programs/qantara/Cargo.toml`:
```toml
anchor-lang = "0.31.1"
anchor-spl = "0.31.1"
```

4. Rebuild:
```bash
anchor clean
anchor build
```

## Or Fix 0.29.0 Installation

If you prefer to stick with 0.29.0, run:

```bash
bash scripts/fix-anchor-install.sh
```

This will:
- Remove the conflicting binary
- Clean up partial installations
- Force install 0.29.0 properly

