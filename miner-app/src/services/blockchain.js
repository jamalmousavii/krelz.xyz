const { ethers } = require('ethers');

class BlockchainService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.wallet = null;
  }

  async connect() {
    if (typeof window !== 'undefined' && window.ethereum) {
      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      this.wallet = await this.signer.getAddress();
      return this.wallet;
    }
    throw new Error('No wallet found');
  }

  async getBalance() {
    if (!this.wallet) {
      throw new Error('Wallet not connected');
    }
    
    const balance = await this.provider.getBalance(this.wallet);
    return ethers.formatEther(balance);
  }

  async signMessage(message) {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }
    return await this.signer.signMessage(message);
  }
}

module.exports = BlockchainService;
