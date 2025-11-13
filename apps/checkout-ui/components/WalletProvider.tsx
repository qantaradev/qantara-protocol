'use client'

import { useMemo } from 'react'
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css'

export function WalletProvider({ children }: { children: React.ReactNode }) {
  // Get RPC URL from environment or default to devnet
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || clusterApiUrl('devnet')
  
  // Determine network from RPC URL
  const network = useMemo(() => {
    if (rpcUrl.includes('mainnet')) {
      return WalletAdapterNetwork.Mainnet
    }
    return WalletAdapterNetwork.Devnet
  }, [rpcUrl])

  // Initialize wallets
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  )

  return (
    <ConnectionProvider endpoint={rpcUrl}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  )
}


