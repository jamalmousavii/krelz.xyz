const axios = require('axios');

class ApiService {
  constructor() {
    this.baseUrl = 'https://krelz.xyz/api';
  }

  async register(wallet, gpu, ram, cpu) {
    const response = await axios.post(`${this.baseUrl}/miners/register`, {
      wallet_address: wallet,
      gpu_model: gpu,
      ram: ram,
      cpu: cpu,
    });
    return response.data;
  }

  async heartbeat(data) {
    const response = await axios.put(`${this.baseUrl}/miners/heartbeat`, data);
    return response.data;
  }

  async getStats() {
    const response = await axios.get(`${this.baseUrl}/stats/network`);
    return response.data;
  }
}

module.exports = ApiService;
