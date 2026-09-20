const crypto = require('crypto');
const axios = require('axios');

const API_URL = process.env.NOWPAYMENTS_API_URL || 'https://api.nowpayments.io/v1';
const API_KEY = process.env.NOWPAYMENTS_API_KEY;
const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET;

// Supported coins configuration
const SUPPORTED_COINS = {
  BTC:  { name: 'Bitcoin',   chain: 'bitcoin',   minAmount: 0.0001,  fee: 0.00005 },
  ETH:  { name: 'Ethereum',  chain: 'ethereum',  minAmount: 0.001,   fee: 0.0005 },
  BNB:  { name: 'BNB',       chain: 'bsc',       minAmount: 0.01,    fee: 0.001 },
  USDT: { name: 'Tether',    chain: 'tron',      minAmount: 1,       fee: 1 },
  TRX:  { name: 'Tron',      chain: 'tron',      minAmount: 10,      fee: 1 },
  DOGE: { name: 'Dogecoin',  chain: 'dogecoin',  minAmount: 10,      fee: 1 },
  XRP:  { name: 'Ripple',    chain: 'ripple',    minAmount: 1,       fee: 0.1 },
};

class NowPaymentsService {
  constructor() {
    if (!API_KEY) {
      console.log('⚠️ NowPayments API key not configured');
    }
    if (!IPN_SECRET) {
      console.log('⚠️ NOWPAYMENTS_IPN_SECRET not configured — webhook verification will be skipped');
    }
  }

  // Get auth headers
  getHeaders() {
    return {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
    };
  }

  // Create payment invoice
  async createInvoice({ userId, coin, amount, orderId }) {
    const coinConfig = SUPPORTED_COINS[coin];
    if (!coinConfig) throw new Error(`Unsupported coin: ${coin}`);

    try {
      const response = await axios.post(`${API_URL}/invoice`, {
        price_amount: amount,
        price_currency: 'usd',
        pay_currency: coin.toLowerCase(),
        order_id: orderId || `krelz-${userId}-${Date.now()}`,
        order_description: `Krelz Network deposit - ${coin}`,
        ipn_callback_url: `${process.env.BACKEND_URL || 'https://krelz.xyz'}/api/payments/deposit/webhook`,
      }, { headers: this.getHeaders() });

      return {
        success: true,
        invoiceId: response.data.id,
        invoiceUrl: response.data.invoice_url,
        payAddress: response.data.pay_address,
        payAmount: response.data.pay_amount,
        payCurrency: response.data.pay_currency,
      };
    } catch (err) {
      console.error('NowPayments createInvoice error:', err.response?.data || err.message);
      return { success: false, error: err.response?.data?.message || err.message };
    }
  }

  // Verify IPN callback signature
  verifyIPN(payload, signature) {
    const sortedPayload = Object.keys(payload)
      .sort()
      .reduce((acc, key) => {
        acc[key] = payload[key];
        return acc;
      }, {});

    const jsonString = JSON.stringify(sortedPayload);
    const hmac = crypto.createHmac('sha512', IPN_SECRET);
    hmac.update(jsonString);
    const calculatedSignature = hmac.digest('hex');

    return calculatedSignature === signature;
  }

  // Process IPN callback
  async processIPN(payload) {
    const { order_id, payment_status, pay_amount, pay_currency, tx_hash } = payload;

    // Extract userId and coin from order_id (format: krelz-{userId}-{timestamp})
    const parts = order_id.split('-');
    const userId = parseInt(parts[1]);
    const coin = pay_currency.toUpperCase();

    if (payment_status === 'finished') {
      return {
        success: true,
        userId,
        coin,
        amount: parseFloat(pay_amount),
        txHash: tx_hash,
        processorId: order_id,
        status: 'completed',
      };
    }

    return {
      success: false,
      userId,
      coin,
      status: payment_status,
    };
  }

  // Create payout (withdrawal)
  async createPayout({ address, amount, coin }) {
    try {
      const response = await axios.post(`${API_URL}/payout`, {
        withdrawals: [{
          address,
          amount,
          currency: coin.toLowerCase(),
        }],
      }, { headers: this.getHeaders() });

      return {
        success: true,
        payoutId: response.data.id,
        txHash: response.data.tx_hash,
        status: response.data.status,
      };
    } catch (err) {
      console.error('NowPayments payout error:', err.response?.data || err.message);
      return { success: false, error: err.response?.data?.message || err.message };
    }
  }

  // Get payment status
  async getPaymentStatus(invoiceId) {
    try {
      const response = await axios.get(`${API_URL}/invoice/${invoiceId}`, {
        headers: this.getHeaders(),
      });
      return { success: true, status: response.data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Get supported coins
  getSupportedCoins() {
    return SUPPORTED_COINS;
  }

  // Get min amount for a coin
  getMinAmount(coin) {
    return SUPPORTED_COINS[coin]?.minAmount || 0;
  }

  // Calculate fee
  calculateFee(amount, coin) {
    const coinConfig = SUPPORTED_COINS[coin];
    if (!coinConfig) return 0;
    return coinConfig.fee;
  }
}

module.exports = new NowPaymentsService();
