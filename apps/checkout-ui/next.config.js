/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com',
  },
}

module.exports = nextConfig


