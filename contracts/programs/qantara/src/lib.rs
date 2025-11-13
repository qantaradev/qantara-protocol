use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::AccountMeta;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::token;

pub mod state;
pub mod errors;
pub mod utils;

use state::*;
use errors::*;

declare_id!("3oM4F5kVGXxid46LavUEjY3d3fREeyEm5dTKDX6ZRreU");

#[program]
pub mod qantara {
    use super::*;

    /// Initialize a merchant configuration
    /// Authority: Merchant owner must sign
    pub fn init_merchant(ctx: Context<InitMerchant>, args: InitMerchantArgs) -> Result<()> {
        require!(
            args.payout_bps
                .checked_add(args.buyback_bps)
                .unwrap_or(10001) <= 10000,
            QantaraError::InvalidBasisPoints
        );
        require!(
            args.burn_of_buyback_bps <= 10000,
            QantaraError::InvalidBasisPoints
        );
        require!(
            args.slippage_bps_max <= 1000, // Max 10% slippage
            QantaraError::SlippageTooHigh
        );

        let config = &mut ctx.accounts.merchant_config;
        config.owner = ctx.accounts.owner.key();
        config.payout_wallet = args.payout_wallet;
        config.allow_sol = args.allow_sol;
        config.allow_usdc = args.allow_usdc;
        config.buyback_mint = args.buyback_mint;
        config.payout_bps = args.payout_bps;
        config.buyback_bps = args.buyback_bps;
        config.burn_of_buyback_bps = args.burn_of_buyback_bps;
        config.slippage_bps_max = args.slippage_bps_max;
        config.router_program = args.router_program;
        config.frozen = false;
        config.bump = ctx.bumps.merchant_config;

        emit!(MerchantInitialized {
            owner: config.owner,
            buyback_mint: config.buyback_mint,
        });

        Ok(())
    }

    /// Update merchant configuration
    /// Authority: Current owner must sign
    pub fn update_merchant(ctx: Context<UpdateMerchant>, args: UpdateMerchantArgs) -> Result<()> {
        let config = &mut ctx.accounts.merchant_config;

        if let Some(payout_bps) = args.payout_bps {
            require!(
                payout_bps
                    .checked_add(config.buyback_bps)
                    .unwrap_or(10001) <= 10000,
                QantaraError::InvalidBasisPoints
            );
            config.payout_bps = payout_bps;
        }

        if let Some(buyback_bps) = args.buyback_bps {
            require!(
                config
                    .payout_bps
                    .checked_add(buyback_bps)
                    .unwrap_or(10001) <= 10000,
                QantaraError::InvalidBasisPoints
            );
            config.buyback_bps = buyback_bps;
        }

        if let Some(burn_bps) = args.burn_of_buyback_bps {
            require!(burn_bps <= 10000, QantaraError::InvalidBasisPoints);
            config.burn_of_buyback_bps = burn_bps;
        }

        if let Some(slippage_bps) = args.slippage_bps_max {
            require!(slippage_bps <= 1000, QantaraError::SlippageTooHigh);
            config.slippage_bps_max = slippage_bps;
        }

        if let Some(frozen) = args.frozen {
            config.frozen = frozen;
            emit!(MerchantFrozen {
                owner: config.owner,
                frozen,
            });
        }

        Ok(())
    }

    /// Execute payment settlement
    /// 1. Receive payment (SOL or USDC)
    /// 2. Split: payout + buyback amounts
    /// 3. CPI to Jupiter to swap buyback amount → target token
    /// 4. Burn portion of acquired tokens
    /// 5. Transfer payout to merchant
    pub fn settle(
        ctx: Context<Settle>,
        amount: u64,
        pay_token: PayToken,
        min_out: u64,
    ) -> Result<()> {
        let config = &ctx.accounts.merchant_config;

        // 1. Validate state
        require!(!config.frozen, QantaraError::MerchantFrozen);
        require!(
            match pay_token {
                PayToken::Sol => config.allow_sol,
                PayToken::Usdc => config.allow_usdc,
            },
            QantaraError::PayTokenNotAllowed
        );

        // 2. Verify router program (allowlist)
        require_keys_eq!(
            ctx.accounts.router_program.key(),
            config.router_program,
            QantaraError::InvalidRouterProgram
        );

        // Validate payout wallet matches config
        require_keys_eq!(
            ctx.accounts.payout_wallet_sol.key(),
            config.payout_wallet,
            QantaraError::InvalidPayoutWallet
        );

        // 3. Calculate splits
        let payout_amount = (amount as u128)
            .checked_mul(config.payout_bps as u128)
            .and_then(|v| v.checked_div(10000))
            .ok_or(QantaraError::InvalidBasisPoints)? as u64;

        let buyback_amount = (amount as u128)
            .checked_mul(config.buyback_bps as u128)
            .and_then(|v| v.checked_div(10000))
            .ok_or(QantaraError::InvalidBasisPoints)? as u64;

        // 4. Receive payment from buyer
        match pay_token {
            PayToken::Sol => {
                // System program transfer
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
                // SPL token transfer
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

        // 5. CPI to Jupiter for swap (buyback_amount → buyback_mint)
        // Note: Jupiter CPI implementation will be in utils module
        // For now, we'll handle the swap via remaining accounts
        // The actual swap instruction should be built off-chain and passed via remaining_accounts
        if buyback_amount > 0 && !ctx.remaining_accounts.is_empty() {
            // Invoke Jupiter swap via remaining accounts
            // The client should build the proper Jupiter swap instruction
            let swap_ix = anchor_lang::solana_program::instruction::Instruction {
                program_id: ctx.accounts.router_program.key(),
                accounts: ctx.remaining_accounts
                    .iter()
                    .map(|acc| AccountMeta {
                        pubkey: acc.key(),
                        is_signer: acc.is_signer,
                        is_writable: acc.is_writable,
                    })
                    .collect(),
                data: vec![], // Instruction data should be built off-chain
            };

            invoke_signed(
                &swap_ix,
                ctx.remaining_accounts,
                &[&[
                    b"merchant",
                    config.owner.as_ref(),
                    &[config.bump],
                ]],
            )?;
        }

        // 6. Verify swap output meets min_out (if buyback occurred)
        let buyback_token_balance = if buyback_amount > 0 {
            ctx.accounts.vault_buyback_token.amount
        } else {
            0
        };

        if buyback_amount > 0 {
            require!(
                buyback_token_balance >= min_out,
                QantaraError::SlippageExceeded
            );
        }

        // 7. Burn portion of acquired tokens
        let burn_amount = if buyback_token_balance > 0 {
            (buyback_token_balance as u128)
                .checked_mul(config.burn_of_buyback_bps as u128)
                .and_then(|v| v.checked_div(10000))
                .ok_or(QantaraError::InvalidBasisPoints)? as u64
        } else {
            0
        };

        if burn_amount > 0 {
            token::burn(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    token::Burn {
                        mint: ctx.accounts.buyback_mint_account.to_account_info(),
                        from: ctx.accounts.vault_buyback_token.to_account_info(),
                        authority: ctx.accounts.merchant_config.to_account_info(),
                    },
                    &[&[
                        b"merchant",
                        config.owner.as_ref(),
                        &[config.bump],
                    ]],
                ),
                burn_amount,
            )?;
        }

        // 8. Transfer payout to merchant
        match pay_token {
            PayToken::Sol => {
                **ctx.accounts.vault_sol.try_borrow_mut_lamports()? -= payout_amount;
                **ctx.accounts.payout_wallet_sol.try_borrow_mut_lamports()? += payout_amount;
            }
            PayToken::Usdc => {
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        token::Transfer {
                            from: ctx.accounts.vault_usdc.to_account_info(),
                            to: ctx.accounts.payout_wallet_usdc.to_account_info(),
                            authority: ctx.accounts.merchant_config.to_account_info(),
                        },
                        &[&[
                            b"merchant",
                            config.owner.as_ref(),
                            &[config.bump],
                        ]],
                    ),
                    payout_amount,
                )?;
            }
        }

        // 9. Emit events
        emit!(PaymentSettled {
            merchant: config.owner,
            payer: ctx.accounts.payer.key(),
            amount,
            pay_token,
            payout_amount,
            buyback_amount: buyback_token_balance,
            burn_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

