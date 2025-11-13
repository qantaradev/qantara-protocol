'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { PublicKey, VersionedTransaction } from '@solana/web3.js'

interface QuoteResponse {
  quoteId: string
  merchantId: string
  amount: string
  payToken: 'SOL' | 'USDC'
  payoutBps: number
  buybackBps: number
  burnBps: number
  buybackAmount: string
  minOut: string
  estimatedTokens: string
  slippageBps: number
  swapTransaction?: string
  expiresAt: number
}

interface MerchantInfo {
  merchantId: string
  merchantOwner: string
  buybackMint: string
  defaultPayoutBps: number
  defaultBuybackBps: number
  defaultBurnBps: number
  allowSol: boolean
  allowUsdc: boolean
}

export default function CheckoutPage() {
  const params = useParams()
  const merchantId = params.merchantId as string
  const { publicKey, signTransaction, connected } = useWallet()
  const { connection } = useConnection()

  const [merchant, setMerchant] = useState<MerchantInfo | null>(null)
  const [price, setPrice] = useState<number>(10.0)
  const [payToken, setPayToken] = useState<'SOL' | 'USDC'>('SOL')
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

  // Fetch merchant info
  useEffect(() => {
    if (!merchantId) return

    fetch(`${apiUrl}/v2/merchants/${merchantId}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error)
        } else {
          setMerchant({
            merchantId: data.merchantId,
            merchantOwner: data.merchantOwner,
            buybackMint: data.buybackMint,
            defaultPayoutBps: data.defaultPayoutBps,
            defaultBuybackBps: data.defaultBuybackBps,
            defaultBurnBps: data.defaultBurnBps,
            allowSol: data.allowSol,
            allowUsdc: data.allowUsdc,
          })
        }
      })
      .catch(err => {
        setError('Failed to load merchant information')
        console.error(err)
      })
  }, [merchantId, apiUrl])

  // Get quote when price or token changes
  useEffect(() => {
    if (!merchant || !price) return

    const timeoutId = setTimeout(() => {
      fetchQuote()
    }, 500) // Debounce

    return () => clearTimeout(timeoutId)
  }, [merchant, price, payToken])

  async function fetchQuote() {
    if (!merchant) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${apiUrl}/v2/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: merchant.merchantId,
          price: price, // Price in SOL or USDC (e.g., 10.0)
          payToken: payToken,
        }),
      })

      const data = await response.json()

      if (data.error) {
        setError(data.error)
        setQuote(null)
      } else {
        setQuote(data)
      }
    } catch (err: any) {
      setError('Failed to get quote')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handlePayment() {
    if (!publicKey || !signTransaction || !quote) {
      setError('Please connect your wallet')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Build transaction
      const buildResponse = await fetch(`${apiUrl}/v2/build-tx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: quote.quoteId,
          merchantId: quote.merchantId,
          payer: publicKey.toBase58(),
          amount: quote.amount,
          payToken: quote.payToken,
          minOut: quote.minOut,
          payoutBps: quote.payoutBps,
          buybackBps: quote.buybackBps,
          burnBps: quote.burnBps,
          swapTransaction: quote.swapTransaction,
        }),
      })

      const buildData = await buildResponse.json()

      if (buildData.error) {
        setError(buildData.error)
        return
      }

      // Deserialize transaction
      const txBuffer = Buffer.from(buildData.transaction, 'base64')
      const tx = VersionedTransaction.deserialize(txBuffer)

      // Sign transaction
      const signedTx = await signTransaction(tx)

      // Send transaction
      const signature = await connection.sendTransaction(signedTx, {
        skipPreflight: false,
      })

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed')

      setSuccess(signature)
      setQuote(null)
    } catch (err: any) {
      setError(err.message || 'Transaction failed')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (!merchant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading merchant information...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Checkout</h1>
            <p className="text-gray-600">Pay with SOL or USDC</p>
          </div>

          {/* Wallet Connection */}
          <div className="mb-6">
            <WalletMultiButton />
          </div>

          {/* Price Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount
            </label>
            <div className="flex gap-4">
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="0.00"
                step="0.01"
                min="0"
              />
              <select
                value={payToken}
                onChange={(e) => setPayToken(e.target.value as 'SOL' | 'USDC')}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                disabled={!merchant.allowSol && !merchant.allowUsdc}
              >
                {merchant.allowSol && <option value="SOL">SOL</option>}
                {merchant.allowUsdc && <option value="USDC">USDC</option>}
              </select>
            </div>
          </div>

          {/* Quote Display */}
          {quote && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-3">Payment Breakdown</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Amount:</span>
                  <span className="font-medium">
                    {parseFloat(quote.amount) / (payToken === 'SOL' ? 1e9 : 1e6)} {payToken}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Merchant Payout:</span>
                  <span className="font-medium">
                    {((parseFloat(quote.amount) * quote.payoutBps) / 10000) / (payToken === 'SOL' ? 1e9 : 1e6)} {payToken}
                  </span>
                </div>
                {quote.buybackBps > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Buyback:</span>
                      <span className="font-medium">
                        {parseFloat(quote.buybackAmount) / (payToken === 'SOL' ? 1e9 : 1e6)} {payToken}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Estimated Tokens:</span>
                      <span className="font-medium">
                        {parseFloat(quote.estimatedTokens) / 1e9} tokens
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-semibold mb-2">Payment Successful!</p>
              <a
                href={`https://solscan.io/tx/${success}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-600 hover:underline text-sm"
              >
                View on Solscan →
              </a>
            </div>
          )}

          {/* Pay Button */}
          <button
            onClick={handlePayment}
            disabled={!connected || !quote || loading || !publicKey}
            className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Processing...' : `Pay ${price} ${payToken}`}
          </button>
        </div>
      </div>
    </div>
  )
}


