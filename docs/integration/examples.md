# Integration Examples

Real-world examples of integrating Qantara Protocol into your application.

## Example 1: Basic Payment Integration

Simple payment integration for a web application.

### Frontend (React + TypeScript)

```typescript
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import axios from 'axios';

const API_BASE = 'http://localhost:3001/v2';

export function useQantaraPayment() {
  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const connection = new Connection('https://api.devnet.solana.com');

  const processPayment = async (
    merchantId: string,
    price: number,
    payToken: 'SOL' | 'USDC'
  ) => {
    try {
      // 1. Get quote
      const quoteResponse = await axios.post(`${API_BASE}/quote`, {
        merchantId,
        price,
        payToken,
      });

      const quote = quoteResponse.data;

      // 2. Build transaction
      const txResponse = await axios.post(`${API_BASE}/build-tx`, {
        quoteId: quote.quoteId,
        merchantId,
        payer: publicKey!.toBase58(),
        amount: quote.amount,
        payToken: quote.payToken,
        minOut: quote.minOut,
        payoutBps: quote.payoutBps,
        buybackBps: quote.buybackBps,
        burnBps: quote.burnBps,
        swapTransaction: quote.swapTransaction,
        priorityFee: 0.0001,
      });

      // 3. Deserialize transaction
      const transactionBuffer = Buffer.from(txResponse.data.transaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuffer);

      // 4. Sign transaction
      const signed = await signTransaction!(transaction);

      // 5. Send transaction
      const signature = await sendTransaction(signed, connection);
      await connection.confirmTransaction(signature);

      return { signature, quote };
    } catch (error) {
      console.error('Payment error:', error);
      throw error;
    }
  };

  return { processPayment };
}
```

### Usage

```typescript
function CheckoutButton() {
  const { processPayment } = useQantaraPayment();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);
    try {
      const result = await processPayment(
        '12345678901234567890',
        100,
        'USDC'
      );
      console.log('Payment successful:', result.signature);
    } catch (error) {
      console.error('Payment failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleCheckout} disabled={loading}>
      {loading ? 'Processing...' : 'Pay with Qantara'}
    </button>
  );
}
```

## Example 2: Merchant Registration

Complete merchant registration flow.

```typescript
import { Connection, PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { getProgram } from '@qantara/api-server/services/program';
import { BN } from '@coral-xyz/anchor';
import axios from 'axios';

const API_BASE = 'http://localhost:3001/v2';

async function registerMerchant(
  merchantOwner: Keypair,
  payoutWallet: PublicKey,
  buybackMint: PublicKey
) {
  const connection = new Connection('https://api.devnet.solana.com');

  // 1. Register via API
  const apiResponse = await axios.post(`${API_BASE}/merchants/register`, {
    merchantOwner: merchantOwner.publicKey.toBase58(),
    payoutWallet: payoutWallet.toBase58(),
    buybackMint: buybackMint.toBase58(),
    defaultPayoutBps: 7000,
    defaultBuybackBps: 3000,
    defaultBurnBps: 5000,
    slippageBps: 100,
    allowSol: true,
    allowUsdc: true,
  });

  const { merchantId, merchantRegistryPDA } = apiResponse.data;

  // 2. Complete on-chain registration
  const program = getProgram(connection);
  const [merchantRegistryPDAKey] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('merchant'),
      Buffer.from(merchantId),
    ],
    program.programId
  );

  await program.methods
    .registerMerchant(
      new BN(merchantId),
      payoutWallet,
      buybackMint
    )
    .accounts({
      merchantRegistry: merchantRegistryPDAKey,
      owner: merchantOwner.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([merchantOwner])
    .rpc();

  return { merchantId, merchantRegistryPDA: merchantRegistryPDAKey };
}
```

## Example 3: Payment with Webhook

Payment processing with webhook notifications.

### Backend (Node.js)

```typescript
import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

// Webhook endpoint
app.post('/webhook/payment', async (req, res) => {
  const { signature, merchantId, amount } = req.body;

  // Verify transaction
  const connection = new Connection('https://api.devnet.solana.com');
  const tx = await connection.getTransaction(signature);

  if (tx && tx.meta?.err === null) {
    // Payment successful
    // Update database, send confirmation email, etc.
    console.log('Payment confirmed:', { signature, merchantId, amount });
  }

  res.json({ received: true });
});

// Payment endpoint
app.post('/api/payment', async (req, res) => {
  const { merchantId, price, payToken } = req.body;

  try {
    // Get quote
    const quote = await axios.post('http://localhost:3001/v2/quote', {
      merchantId,
      price,
      payToken,
    });

    // Build transaction
    const tx = await axios.post('http://localhost:3001/v2/build-tx', {
      quoteId: quote.data.quoteId,
      merchantId,
      payer: req.body.payer,
      amount: quote.data.amount,
      payToken: quote.data.payToken,
      minOut: quote.data.minOut,
      payoutBps: quote.data.payoutBps,
      buybackBps: quote.data.buybackBps,
      burnBps: quote.data.burnBps,
      swapTransaction: quote.data.swapTransaction,
    });

    res.json({
      transaction: tx.data.transaction,
      quote: quote.data,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Example 4: E-commerce Integration

E-commerce checkout integration.

```typescript
interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CheckoutData {
  merchantId: string;
  items: CartItem[];
  payToken: 'SOL' | 'USDC';
}

async function checkoutWithQantara(data: CheckoutData) {
  // Calculate total
  const total = data.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Get quote
  const quote = await axios.post('http://localhost:3001/v2/quote', {
    merchantId: data.merchantId,
    price: total,
    payToken: data.payToken,
  });

  // Build transaction
  const tx = await axios.post('http://localhost:3001/v2/build-tx', {
    quoteId: quote.data.quoteId,
    merchantId: data.merchantId,
    payer: wallet.publicKey.toBase58(),
    amount: quote.data.amount,
    payToken: quote.data.payToken,
    minOut: quote.data.minOut,
    payoutBps: quote.data.payoutBps,
    buybackBps: quote.data.buybackBps,
    burnBps: quote.data.burnBps,
    swapTransaction: quote.data.swapTransaction,
  });

  // Sign and send
  const transaction = VersionedTransaction.deserialize(
    Buffer.from(tx.data.transaction, 'base64')
  );
  transaction.sign([wallet.keypair]);
  const signature = await connection.sendTransaction(transaction);

  // Wait for confirmation
  await connection.confirmTransaction(signature);

  // Update order status
  await updateOrderStatus(orderId, 'paid', signature);

  return { signature, quote: quote.data };
}
```

## Example 5: Subscription Payments

Recurring payment integration.

```typescript
interface Subscription {
  id: string;
  merchantId: string;
  amount: number;
  frequency: 'monthly' | 'yearly';
  payToken: 'SOL' | 'USDC';
}

async function processSubscription(subscription: Subscription) {
  // Get quote
  const quote = await axios.post('http://localhost:3001/v2/quote', {
    merchantId: subscription.merchantId,
    price: subscription.amount,
    payToken: subscription.payToken,
  });

  // Build transaction
  const tx = await axios.post('http://localhost:3001/v2/build-tx', {
    quoteId: quote.data.quoteId,
    merchantId: subscription.merchantId,
    payer: subscriptionPayer.toBase58(),
    amount: quote.data.amount,
    payToken: quote.data.payToken,
    minOut: quote.data.minOut,
    payoutBps: quote.data.payoutBps,
    buybackBps: quote.data.buybackBps,
    burnBps: quote.data.burnBps,
    swapTransaction: quote.data.swapTransaction,
  });

  // Process payment
  const transaction = VersionedTransaction.deserialize(
    Buffer.from(tx.data.transaction, 'base64')
  );
  transaction.sign([subscriptionKeypair]);
  const signature = await connection.sendTransaction(transaction);

  // Schedule next payment
  if (subscription.frequency === 'monthly') {
    scheduleNextPayment(subscription.id, 30);
  } else {
    scheduleNextPayment(subscription.id, 365);
  }

  return signature;
}
```

## Best Practices

### Error Handling

```typescript
try {
  const result = await processPayment(merchantId, price, payToken);
  // Handle success
} catch (error) {
  if (error.response?.status === 400) {
    // Validation error
    console.error('Invalid request:', error.response.data);
  } else if (error.response?.status === 404) {
    // Merchant not found
    console.error('Merchant not found');
  } else if (error.response?.status === 403) {
    // Merchant frozen
    console.error('Merchant is frozen');
  } else {
    // Other error
    console.error('Payment error:', error);
  }
}
```

### Retry Logic

```typescript
async function processPaymentWithRetry(
  merchantId: string,
  price: number,
  payToken: 'SOL' | 'USDC',
  maxRetries = 3
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await processPayment(merchantId, price, payToken);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

### Loading States

```typescript
const [paymentState, setPaymentState] = useState<
  'idle' | 'quoting' | 'building' | 'signing' | 'sending' | 'success' | 'error'
>('idle');

async function handlePayment() {
  setPaymentState('quoting');
  const quote = await getQuote(...);

  setPaymentState('building');
  const tx = await buildTransaction(...);

  setPaymentState('signing');
  const signed = await signTransaction(tx);

  setPaymentState('sending');
  const signature = await sendTransaction(signed);

  setPaymentState('success');
}
```

## Next Steps

- [API Documentation](../api/overview.md) - Complete API reference
- [Quick Start Guide](../getting-started/quickstart.md) - Getting started
- [Architecture Overview](../architecture/overview.md) - System architecture

