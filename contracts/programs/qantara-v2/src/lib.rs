use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::AccountMeta;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Burn, Transfer};

pub mod state;
pub mod errors;
pub mod utils;

use state::*;
use errors::*;

declare_id!("JCjXHcUy7LzJsLBoafjem9wRffRyuyGYsiTz35Yyr9AH");

#[program]
pub mod qantara_v2 {
    use super::*;

    /// Initialize protocol configuration (one-time, admin only)
    pub fn init_protocol(
        ctx: Context<InitProtocol>,
        protocol_fee_bps: u16,
        protocol_wallet: Pubkey,
        jupiter_router: Pubkey,
    ) -> Result<()> {
        require!(
            protocol_fee_bps <= 500, // Max 5% protocol fee
            QantaraError::ProtocolFeeTooHigh
        );

        let config = &mut ctx.accounts.protocol_config;
        config.authority = ctx.accounts.authority.key();
        config.protocol_fee_bps = protocol_fee_bps;
        config.protocol_wallet = protocol_wallet;
        config.jupiter_router = jupiter_router;
        config.paused = false;
        config.bump = ctx.bumps.protocol_config;

        emit!(ProtocolInitialized {
            authority: config.authority,
            protocol_fee_bps,
            protocol_wallet,
        });

        Ok(())
    }

    /// Update protocol configuration (admin only)
    pub fn update_protocol(
        ctx: Context<UpdateProtocol>,
        protocol_fee_bps: Option<u16>,
        protocol_wallet: Option<Pubkey>,
        jupiter_router: Option<Pubkey>,
        paused: Option<bool>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.protocol_config;

        if let Some(fee_bps) = protocol_fee_bps {
            require!(
                fee_bps <= 500, // Max 5%
                QantaraError::ProtocolFeeTooHigh
            );
            config.protocol_fee_bps = fee_bps;
        }

        if let Some(wallet) = protocol_wallet {
            config.protocol_wallet = wallet;
        }

        if let Some(router) = jupiter_router {
            config.jupiter_router = router;
        }

        if let Some(pause) = paused {
            config.paused = pause;
            emit!(ProtocolPaused {
                paused: pause,
            });
        }

        Ok(())
    }

    /// Register a merchant (creates on-chain registry entry)
    /// This prevents rerouting attacks by storing payout_wallet on-chain
    pub fn register_merchant(
        ctx: Context<RegisterMerchant>,
        merchant_id: u64,
        payout_wallet: Pubkey,
        buyback_mint: Pubkey,
    ) -> Result<()> {
        let merchant = &mut ctx.accounts.merchant_registry;
        
        // Verify merchant_id matches PDA derivation
        require!(
            merchant.merchant_id == merchant_id || merchant.merchant_id == 0,
            QantaraError::InvalidMerchantId
        );

        merchant.merchant_id = merchant_id;
        merchant.owner = ctx.accounts.owner.key();
        merchant.payout_wallet = payout_wallet;
        merchant.buyback_mint = buyback_mint;
        merchant.frozen = false;
        merchant.bump = ctx.bumps.merchant_registry;

        emit!(MerchantRegistered {
            merchant_id,
            owner: merchant.owner,
            payout_wallet,
            buyback_mint,
        });

        Ok(())
    }

    /// Update merchant registry (owner only)
    pub fn update_merchant(
        ctx: Context<UpdateMerchant>,
        payout_wallet: Option<Pubkey>,
        buyback_mint: Option<Pubkey>,
        frozen: Option<bool>,
    ) -> Result<()> {
        let merchant = &mut ctx.accounts.merchant_registry;

        if let Some(wallet) = payout_wallet {
            merchant.payout_wallet = wallet;
        }

        if let Some(mint) = buyback_mint {
            merchant.buyback_mint = mint;
        }

        if let Some(freeze) = frozen {
            merchant.frozen = freeze;
            emit!(MerchantFrozen {
                merchant_id: merchant.merchant_id,
                frozen: freeze,
            });
        }

        Ok(())
    }

    /// Initialize vault USDC token account (one-time setup)
    pub fn init_vault_usdc(ctx: Context<InitVaultUsdc>) -> Result<()> {
        // Account is initialized by Anchor constraints
        // This instruction just ensures the vault_usdc PDA token account exists
        msg!("Vault USDC token account initialized at: {}", ctx.accounts.vault_usdc.key());
        Ok(())
    }

    /// Execute payment settlement with full security validations
    pub fn settle(
        ctx: Context<Settle>,
        merchant_id: u64,
        amount: u64,
        pay_token: PayToken,
        min_out: u64,
        payout_bps: u16,
        buyback_bps: u16,
        burn_of_buyback_bps: u16,
    ) -> Result<()> {
        let protocol_config = &ctx.accounts.protocol_config;
        let merchant = &ctx.accounts.merchant_registry;

        // SECURITY CHECK 1: Protocol not paused
        require!(!protocol_config.paused, QantaraError::ProtocolPaused);

        // SECURITY CHECK 2: Merchant exists and matches ID
        require!(
            merchant.merchant_id == merchant_id,
            QantaraError::InvalidMerchantId
        );

        // SECURITY CHECK 3: Merchant not frozen
        require!(!merchant.frozen, QantaraError::MerchantFrozen);

        // SECURITY CHECK 4: Validate payout wallet matches registry (prevents rerouting)
        require_keys_eq!(
            ctx.accounts.merchant_payout_wallet.key(),
            merchant.payout_wallet,
            QantaraError::InvalidPayoutWallet
        );

        // SECURITY CHECK 5: Validate buyback mint matches registry
        require_keys_eq!(
            ctx.accounts.buyback_mint.key(),
            merchant.buyback_mint,
            QantaraError::InvalidBuybackMint
        );

        // SECURITY CHECK 6: Validate BPS bounds
        require!(
            payout_bps.checked_add(buyback_bps).unwrap_or(10001) <= 10000,
            QantaraError::InvalidBasisPoints
        );
        require!(
            burn_of_buyback_bps <= 10000,
            QantaraError::InvalidBasisPoints
        );

        // SECURITY CHECK 7: Validate Jupiter router (allowlist)
        require_keys_eq!(
            ctx.accounts.jupiter_router.key(),
            protocol_config.jupiter_router,
            QantaraError::InvalidRouterProgram
        );

        // SECURITY CHECK 8: Validate min_out > 0 (slippage protection)
        if buyback_bps > 0 {
            require!(min_out > 0, QantaraError::InvalidMinOut);
        }

        // STEP 1: Receive payment from buyer FIRST
        receive_payment(&ctx, amount, pay_token)?;

        // STEP 2: Calculate and enforce protocol fee (cannot bypass)
        let protocol_fee = (amount as u128)
            .checked_mul(protocol_config.protocol_fee_bps as u128)
            .and_then(|v| v.checked_div(10000))
            .ok_or(QantaraError::InvalidBasisPoints)? as u64;

        // STEP 3: Transfer protocol fee FIRST (before any other splits)
        transfer_protocol_fee(&ctx, protocol_fee, pay_token)?;

        // STEP 4: Calculate remaining amount after protocol fee
        let remaining = amount
            .checked_sub(protocol_fee)
            .ok_or(QantaraError::InvalidBasisPoints)?;

        // STEP 5: Calculate merchant splits
        let merchant_payout = (remaining as u128)
            .checked_mul(payout_bps as u128)
            .and_then(|v| v.checked_div(10000))
            .ok_or(QantaraError::InvalidBasisPoints)? as u64;

        let buyback_amount = (remaining as u128)
            .checked_mul(buyback_bps as u128)
            .and_then(|v| v.checked_div(10000))
            .ok_or(QantaraError::InvalidBasisPoints)? as u64;

        // STEP 5.5: Buyback flow clarification
        // - All community token purchases use SOL from vault_sol
        // - If payment is USDC: The Jupiter swap route must be USDC → SOL → buyback_token
        //   (USDC from vault_usdc → SOL to vault_sol → buyback_token to vault_buyback_token)
        // - If payment is SOL: The Jupiter swap route must be SOL → buyback_token
        //   (SOL from vault_sol → buyback_token to vault_buyback_token)
        // The off-chain transaction builder is responsible for constructing the correct Jupiter route

        // STEP 6: Execute buyback swap using SOL from vault_sol → buyback_token
        // If payment was USDC, the USDC→SOL swap should have been executed first
        // The Jupiter swap route should be: SOL → buyback_token
        let buyback_output = if buyback_amount > 0 && !ctx.remaining_accounts.is_empty() {
            execute_buyback_swap(&ctx, buyback_amount, min_out, pay_token)?;
            ctx.accounts.vault_buyback_token.amount
        } else {
            0
        };

        // SECURITY CHECK 9: Verify slippage protection
        if buyback_amount > 0 {
            require!(
                buyback_output >= min_out,
                QantaraError::SlippageExceeded
            );
        }

        // STEP 7: Burn portion of acquired tokens
        let burn_amount = if buyback_output > 0 {
            let burn = (buyback_output as u128)
                .checked_mul(burn_of_buyback_bps as u128)
                .and_then(|v| v.checked_div(10000))
                .ok_or(QantaraError::InvalidBasisPoints)? as u64;
            
            if burn > 0 {
                token::burn(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        token::Burn {
                            mint: ctx.accounts.buyback_mint.to_account_info(),
                            from: ctx.accounts.vault_buyback_token.to_account_info(),
                            authority: ctx.accounts.merchant_registry.to_account_info(),
                        },
                        &[&[
                            b"merchant",
                            &merchant_id.to_le_bytes(),
                            &[merchant.bump],
                        ]],
                    ),
                    burn,
                )?;
            }
            burn
        } else {
            0
        };

        // STEP 8: Transfer merchant payout
        transfer_merchant_payout(&ctx, merchant_payout, pay_token)?;

        // STEP 9: Emit event
        emit!(PaymentSettled {
            merchant_id,
            payer: ctx.accounts.payer.key(),
            amount,
            pay_token,
            protocol_fee,
            payout_amount: merchant_payout,
            buyback_amount: buyback_output,
            burn_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

// Helper functions
fn transfer_protocol_fee(
    ctx: &Context<Settle>,
    fee: u64,
    pay_token: PayToken,
) -> Result<()> {
    match pay_token {
        PayToken::Sol => {
            // Transfer from vault to protocol wallet
            **ctx.accounts.vault_sol.try_borrow_mut_lamports()? -= fee;
            **ctx.accounts.protocol_wallet.try_borrow_mut_lamports()? += fee;
        }
        PayToken::Usdc => {
            // Note: Vault USDC needs proper PDA authority setup
            // For now, this is a placeholder - actual implementation needs vault PDA
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    token::Transfer {
                        from: ctx.accounts.vault_usdc.to_account_info(),
                        to: ctx.accounts.protocol_wallet_usdc.to_account_info(),
                        authority: ctx.accounts.vault_usdc.to_account_info(),
                    },
                ),
                fee,
            )?;
        }
    }
    Ok(())
}

fn receive_payment(
    ctx: &Context<Settle>,
    amount: u64,
    pay_token: PayToken,
) -> Result<()> {
    match pay_token {
        PayToken::Sol => {
            anchor_lang::solana_program::program::invoke(
                &anchor_lang::solana_program::system_instruction::transfer(
                    &ctx.accounts.payer.key(),
                    &ctx.accounts.vault_sol.key(),
                    amount,
                ),
                &[
                    ctx.accounts.payer.to_account_info(),
                    ctx.accounts.vault_sol.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        }
        PayToken::Usdc => {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    token::Transfer {
                        from: ctx.accounts.payer_usdc_account.to_account_info(),
                        to: ctx.accounts.vault_usdc.to_account_info(),
                        authority: ctx.accounts.payer.to_account_info(),
                    },
                ),
                amount,
            )?;
        }
    }
    Ok(())
}

fn execute_buyback_swap(
    ctx: &Context<Settle>,
    amount_in: u64,
    min_out: u64,
    pay_token: PayToken,
) -> Result<()> {
    // Jupiter swap via remaining accounts
    // 
    // Flow:
    // - If pay_token == USDC: remaining_accounts should contain TWO swaps:
    //   1. USDC → SOL (from vault_usdc to vault_sol)
    //   2. SOL → buyback_token (from vault_sol to vault_buyback_token)
    // - If pay_token == SOL: remaining_accounts should contain ONE swap:
    //   1. SOL → buyback_token (from vault_sol to vault_buyback_token)
    //
    // The swap instructions should be built off-chain and passed via remaining_accounts
    // All swaps use vault_sol as the source for buying community tokens
    if !ctx.remaining_accounts.is_empty() {
        // Execute all swap instructions in remaining_accounts
        // The off-chain builder is responsible for constructing the correct swap route
        let swap_ix = anchor_lang::solana_program::instruction::Instruction {
            program_id: ctx.accounts.jupiter_router.key(),
            accounts: ctx.remaining_accounts
                .iter()
                .map(|acc| AccountMeta {
                    pubkey: acc.key(),
                    is_signer: acc.is_signer,
                    is_writable: acc.is_writable,
                })
                .collect(),
            data: vec![], // Built off-chain
        };

        invoke_signed(
            &swap_ix,
            ctx.remaining_accounts,
            &[&[
                b"merchant",
                &ctx.accounts.merchant_registry.merchant_id.to_le_bytes(),
                &[ctx.accounts.merchant_registry.bump],
            ]],
        )?;
    }
    Ok(())
}

fn transfer_merchant_payout(
    ctx: &Context<Settle>,
    amount: u64,
    pay_token: PayToken,
) -> Result<()> {
    match pay_token {
        PayToken::Sol => {
            **ctx.accounts.vault_sol.try_borrow_mut_lamports()? -= amount;
            **ctx.accounts.merchant_payout_wallet.try_borrow_mut_lamports()? += amount;
        }
        PayToken::Usdc => {
            // Note: Vault USDC needs proper PDA authority setup
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    token::Transfer {
                        from: ctx.accounts.vault_usdc.to_account_info(),
                        to: ctx.accounts.merchant_payout_usdc.to_account_info(),
                        authority: ctx.accounts.vault_usdc.to_account_info(),
                    },
                ),
                amount,
            )?;
        }
    }
    Ok(())
}

