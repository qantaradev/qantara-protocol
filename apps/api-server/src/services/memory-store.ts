/**
 * In-Memory Storage for Payment Links
 * 
 * This replaces database storage for the MVP.
 * Payment links are stored in memory (Map).
 * 
 * Note: Data is lost on server restart.
 * For production, this should be replaced with database or persistent storage.
 */

export interface PaymentLink {
  linkId: string;
  merchantId: string;
  merchantOwner: string;
  payoutWallet: string;
  buybackMint: string;
  price: number; // Price in SOL
  payoutBps: number; // Basis points (0-10000)
  buybackBps: number; // Basis points (0-10000)
  burnBps: number; // Basis points (0-10000) - % of buyback to burn
  createdAt: Date;
  description?: string; // Optional product description
}

class MemoryStore {
  private paymentLinks = new Map<string, PaymentLink>();
  private merchantLinks = new Map<string, string[]>(); // merchantId -> linkIds[]

  /**
   * Create a new payment link
   */
  createPaymentLink(data: Omit<PaymentLink, 'linkId' | 'createdAt'>): PaymentLink {
    const linkId = this.generateLinkId();
    const link: PaymentLink = {
      ...data,
      linkId,
      createdAt: new Date(),
    };

    this.paymentLinks.set(linkId, link);

    // Track links per merchant
    const merchantLinks = this.merchantLinks.get(data.merchantId) || [];
    merchantLinks.push(linkId);
    this.merchantLinks.set(data.merchantId, merchantLinks);

    return link;
  }

  /**
   * Get payment link by ID
   */
  getPaymentLink(linkId: string): PaymentLink | null {
    return this.paymentLinks.get(linkId) || null;
  }

  /**
   * Get all payment links for a merchant
   */
  getMerchantLinks(merchantId: string): PaymentLink[] {
    const linkIds = this.merchantLinks.get(merchantId) || [];
    return linkIds
      .map(id => this.paymentLinks.get(id))
      .filter((link): link is PaymentLink => link !== undefined);
  }

  /**
   * Delete a payment link
   */
  deletePaymentLink(linkId: string): boolean {
    const link = this.paymentLinks.get(linkId);
    if (!link) return false;

    this.paymentLinks.delete(linkId);

    // Remove from merchant's link list
    const merchantLinks = this.merchantLinks.get(link.merchantId) || [];
    const index = merchantLinks.indexOf(linkId);
    if (index > -1) {
      merchantLinks.splice(index, 1);
      this.merchantLinks.set(link.merchantId, merchantLinks);
    }

    return true;
  }

  /**
   * Generate a short, unique link ID
   * Format: 8-character alphanumeric (e.g., "abc12345")
   */
  private generateLinkId(): string {
    // Generate random ID and check for collisions
    let linkId: string;
    let attempts = 0;
    do {
      linkId = Math.random().toString(36).substring(2, 10);
      attempts++;
      if (attempts > 100) {
        // Fallback to timestamp-based ID if too many collisions
        linkId = Date.now().toString(36).substring(2, 10);
        break;
      }
    } while (this.paymentLinks.has(linkId));

    return linkId;
  }

  /**
   * Get statistics (for monitoring)
   */
  getStats() {
    return {
      totalLinks: this.paymentLinks.size,
      totalMerchants: this.merchantLinks.size,
    };
  }

  /**
   * Clear all data (for testing)
   */
  clear() {
    this.paymentLinks.clear();
    this.merchantLinks.clear();
  }
}

// Singleton instance
export const memoryStore = new MemoryStore();

