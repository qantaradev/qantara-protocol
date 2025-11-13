use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Mint};

/// Global protocol configuration
#[account]
#[derive(InitSpace)]
pub struct ProtocolConfig {
    pub authority: Pubkey,              // Protocol admin (multisig)
    pub protocol_fee_bps: u16,         // Protocol fee (e.g., 100 = 1%)
    pub protocol_wallet: Pubkey,       // Fee recipient
    pub jupiter_router: Pubkey,         // Jupiter v6 program
    pub paused: bool,                   // Emergency pause
    pub bump: u8,                       // PDA bump
}

/// On-chain merchant registry (REQUIRED for security)
/// Prevents rerouting attacks by validating payout_wallet on-chain
#[account]
#[derive(InitSpace)]
pub struct MerchantRegistry {
    pub merchant_id: u64,              // Hash-based merchant ID
    pub owner: Pubkey,                  // Merchant owner (can update config)
    pub payout_wallet: Pubkey,          // CRITICAL: Validated on-chain
    pub buyback_mint: Pubkey,           // CRITICAL: Validated on-chain
    pub frozen: bool,                    // Emergency freeze
    pub bump: u8,                       // PDA bump
}

/// Initialize protocol context
#[derive(Accounts)]
pub struct InitProtocol<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ProtocolConfig::INIT_SPACE,
        seeds = [b"protocol"],
        bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Update protocol context
#[derive(Accounts)]
pub struct UpdateProtocol<'info> {
    #[account(
        mut,
        seeds = [b"protocol"],
        bump = protocol_config.bump,
        has_one = authority
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    pub authority: Signer<'info>,
}

/// Register merchant context
#[derive(Accounts)]
#[instruction(merchant_id: u64)]
pub struct RegisterMerchant<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + MerchantRegistry::INIT_SPACE,
        seeds = [b"merchant", &merchant_id.to_le_bytes()],
        bump
    )]
    pub merchant_registry: Account<'info, MerchantRegistry>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Update merchant context
#[derive(Accounts)]
pub struct UpdateMerchant<'info> {
    #[account(
        mut,
        seeds = [b"merchant", &merchant_registry.merchant_id.to_le_bytes()],
        bump = merchant_registry.bump,
        has_one = owner
    )]
    pub merchant_registry: Account<'info, MerchantRegistry>,

    pub owner: Signer<'info>,
}

/// Payment settlement context
#[derive(Accounts)]
#[instruction(merchant_id: u64)]
pub struct Settle<'info> {
    /// Protocol configuration
    #[account(
        seeds = [b"protocol"],
        bump = protocol_config.bump
    )]
    pub protocol_config: Account<'info, ProtocolConfig>,

    /// Merchant registry (validated on-chain)
    #[account(
        seeds = [b"merchant", &merchant_id.to_le_bytes()],
        bump = merchant_registry.bump
    )]
    pub merchant_registry: Account<'info, MerchantRegistry>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Vault for SOL (PDA owned by program)
    #[account(mut)]
    pub vault_sol: AccountInfo<'info>,

    /// CHECK: Vault USDC token account (PDA-owned, must be initialized before first use)
    #[account(mut)]
    pub vault_usdc: Account<'info, TokenAccount>,

    /// CHECK: USDC mint
    pub usdc_mint: AccountInfo<'info>,

    #[account(mut)]
    pub vault_buyback_token: Account<'info, TokenAccount>,

    #[account(mut)]
    pub buyback_mint: Account<'info, Mint>,

    /// CHECK: Protocol fee recipient (SOL)
    #[account(mut)]
    pub protocol_wallet: AccountInfo<'info>,

    /// CHECK: Protocol fee recipient (USDC)
    #[account(mut)]
    pub protocol_wallet_usdc: Account<'info, TokenAccount>,

    /// CHECK: Merchant payout destination (validated against registry)
    #[account(mut)]
    pub merchant_payout_wallet: AccountInfo<'info>,

    /// CHECK: Merchant payout destination (USDC)
    #[account(mut)]
    pub merchant_payout_usdc: Account<'info, TokenAccount>,

    /// CHECK: Payer USDC account
    #[account(
        token::mint = usdc_mint
    )]
    pub payer_usdc_account: Account<'info, TokenAccount>,

    /// CHECK: Jupiter router program (validated against protocol config)
    pub jupiter_router: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,

    // Remaining accounts: Jupiter swap route accounts (dynamic)
}

/// Initialize vault USDC token account context
#[derive(Accounts)]
pub struct InitVaultUsdc<'info> {
    #[account(
        init,
        payer = payer,
        token::mint = usdc_mint,
        token::authority = vault_usdc,
        seeds = [b"vault_usdc", usdc_mint.key().as_ref()],
        bump
    )]
    pub vault_usdc: Account<'info, TokenAccount>,

    /// CHECK: USDC mint
    pub usdc_mint: AccountInfo<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Instruction arguments
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitProtocolArgs {
    pub protocol_fee_bps: u16,
    pub protocol_wallet: Pubkey,
    pub jupiter_router: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RegisterMerchantArgs {
    pub merchant_id: u64,
    pub payout_wallet: Pubkey,
    pub buyback_mint: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum PayToken {
    Sol,
    Usdc,
}

/// Events
#[event]
pub struct ProtocolInitialized {
    pub authority: Pubkey,
    pub protocol_fee_bps: u16,
    pub protocol_wallet: Pubkey,
}

#[event]
pub struct ProtocolPaused {
    pub paused: bool,
}

#[event]
pub struct MerchantRegistered {
    pub merchant_id: u64,
    pub owner: Pubkey,
    pub payout_wallet: Pubkey,
    pub buyback_mint: Pubkey,
}

#[event]
pub struct MerchantFrozen {
    pub merchant_id: u64,
    pub frozen: bool,
}

#[event]
pub struct PaymentSettled {
    pub merchant_id: u64,
    pub payer: Pubkey,
    pub amount: u64,
    pub pay_token: PayToken,
    pub protocol_fee: u64,
    pub payout_amount: u64,
    pub buyback_amount: u64,
    pub burn_amount: u64,
    pub timestamp: i64,
}

