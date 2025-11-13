use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Mint};

/// Merchant configuration account
#[account]
#[derive(InitSpace)]
pub struct MerchantConfig {
    pub owner: Pubkey,                  // 32
    pub payout_wallet: Pubkey,          // 32
    pub allow_sol: bool,                // 1
    pub allow_usdc: bool,               // 1
    pub buyback_mint: Pubkey,           // 32 (e.g., $PUMP)
    pub payout_bps: u16,                // 2
    pub buyback_bps: u16,               // 2
    pub burn_of_buyback_bps: u16,       // 2
    pub slippage_bps_max: u16,          // 2
    pub router_program: Pubkey,         // 32 (Jupiter v6)
    pub frozen: bool,                   // 1
    pub bump: u8,                       // 1
}

/// Initialize merchant context
#[derive(Accounts)]
pub struct InitMerchant<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + MerchantConfig::INIT_SPACE,
        seeds = [b"merchant", owner.key().as_ref()],
        bump
    )]
    pub merchant_config: Account<'info, MerchantConfig>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Update merchant context
#[derive(Accounts)]
pub struct UpdateMerchant<'info> {
    #[account(
        mut,
        seeds = [b"merchant", owner.key().as_ref()],
        bump = merchant_config.bump,
        has_one = owner
    )]
    pub merchant_config: Account<'info, MerchantConfig>,

    pub owner: Signer<'info>,
}

/// Payment settlement context
#[derive(Accounts)]
pub struct Settle<'info> {
    #[account(
        seeds = [b"merchant", merchant_config.owner.as_ref()],
        bump = merchant_config.bump
    )]
    pub merchant_config: Account<'info, MerchantConfig>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Vault for SOL (PDA owned by program)
    /// Note: This should be derived as a PDA, but for flexibility we'll validate it off-chain
    #[account(mut)]
    pub vault_sol: AccountInfo<'info>,

    #[account(
        mut,
        token::mint = usdc_mint
    )]
    pub vault_usdc: Account<'info, TokenAccount>,

    /// CHECK: USDC mint (validated off-chain)
    pub usdc_mint: AccountInfo<'info>,

    #[account(
        mut,
        token::mint = buyback_mint_account
    )]
    pub vault_buyback_token: Account<'info, TokenAccount>,

    #[account(mut)]
    pub buyback_mint_account: Account<'info, Mint>,

    /// CHECK: Payout destination (validated against config)
    #[account(mut)]
    pub payout_wallet_sol: AccountInfo<'info>,

    #[account(
        mut,
        token::mint = usdc_mint
    )]
    pub payout_wallet_usdc: Account<'info, TokenAccount>,

    /// CHECK: Optional USDC account for payer
    #[account(
        token::mint = usdc_mint
    )]
    pub payer_usdc_account: Account<'info, TokenAccount>,

    /// CHECK: Jupiter router program (validated against config)
    pub router_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,

    // Remaining accounts: Jupiter swap route accounts (dynamic)
}

/// Instruction arguments
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitMerchantArgs {
    pub payout_wallet: Pubkey,
    pub allow_sol: bool,
    pub allow_usdc: bool,
    pub buyback_mint: Pubkey,
    pub payout_bps: u16,
    pub buyback_bps: u16,
    pub burn_of_buyback_bps: u16,
    pub slippage_bps_max: u16,
    pub router_program: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdateMerchantArgs {
    pub payout_bps: Option<u16>,
    pub buyback_bps: Option<u16>,
    pub burn_of_buyback_bps: Option<u16>,
    pub slippage_bps_max: Option<u16>,
    pub frozen: Option<bool>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub enum PayToken {
    Sol,
    Usdc,
}

/// Events
#[event]
pub struct MerchantInitialized {
    pub owner: Pubkey,
    pub buyback_mint: Pubkey,
}

#[event]
pub struct MerchantFrozen {
    pub owner: Pubkey,
    pub frozen: bool,
}

#[event]
pub struct PaymentSettled {
    pub merchant: Pubkey,
    pub payer: Pubkey,
    pub amount: u64,
    pub pay_token: PayToken,
    pub payout_amount: u64,
    pub buyback_amount: u64,
    pub burn_amount: u64,
    pub timestamp: i64,
}

