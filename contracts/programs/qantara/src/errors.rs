use anchor_lang::prelude::*;

#[error_code]
pub enum QantaraError {
    #[msg("Payout + buyback basis points exceed 10000")]
    InvalidBasisPoints,
    #[msg("Slippage tolerance exceeds maximum (1000 bps)")]
    SlippageTooHigh,
    #[msg("Merchant account is frozen")]
    MerchantFrozen,
    #[msg("Payment token not allowed by merchant")]
    PayTokenNotAllowed,
    #[msg("Router program does not match config")]
    InvalidRouterProgram,
    #[msg("Swap output below minimum (slippage exceeded)")]
    SlippageExceeded,
    #[msg("Unauthorized: Only owner can perform this action")]
    Unauthorized,
    #[msg("Invalid payout wallet")]
    InvalidPayoutWallet,
    #[msg("Invalid payer account")]
    InvalidPayerAccount,
}

