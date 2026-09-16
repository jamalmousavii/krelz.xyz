const axios = require('axios');

class ApiService {
  constructor() {
    this.baseUrl = 'https://krelz.xyz/api';
  }

  async register(minerToken, gpu, ram, cpu, models) {
    const response = await axios.post(`${this.baseUrl}/miners/setup`, {
      miner_token: minerToken,
      gpu_model: gpu,
      ram: ram,
      cpu: cpu,
      models: models,
    });
    return response.data;
  }

  async heartbeat(minerId, data) {
    const response = await axios.put(`${this.baseUrl}/miners/${minerId}/heartbeat`, data);
    return response.data;
  }

  async getStats() {
    const response = await axios.get(`${this.baseUrl}/stats/network`);
    return response.data;
  }
}

module.exports = ApiService;
