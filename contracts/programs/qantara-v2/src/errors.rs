use anchor_lang::prelude::*;

#[error_code]
pub enum QantaraError {
    #[msg("Protocol fee exceeds maximum (500 bps = 5%)")]
    ProtocolFeeTooHigh,
    #[msg("Protocol is paused")]
    ProtocolPaused,
    #[msg("Invalid merchant ID")]
    InvalidMerchantId,
    #[msg("Merchant account is frozen")]
    MerchantFrozen,
    #[msg("Invalid payout wallet (rerouting attack prevented)")]
    InvalidPayoutWallet,
    #[msg("Invalid buyback mint")]
    InvalidBuybackMint,
    #[msg("Payout + buyback basis points exceed 10000")]
    InvalidBasisPoints,
    #[msg("Slippage tolerance exceeds maximum")]
    SlippageTooHigh,
    #[msg("Payment token not allowed")]
    PayTokenNotAllowed,
    #[msg("Router program does not match protocol config")]
    InvalidRouterProgram,
    #[msg("Swap output below minimum (slippage exceeded)")]
    SlippageExceeded,
    #[msg("Invalid min_out (must be > 0 for buyback)")]
    InvalidMinOut,
    #[msg("Unauthorized: Only owner can perform this action")]
    Unauthorized,
}

