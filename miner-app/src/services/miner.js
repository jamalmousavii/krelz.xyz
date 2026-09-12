const si = require('systeminformation');
const OllamaService = require('./ollama');
const ApiService = require('./api');

class MinerService {
  constructor() {
    this.ollama = new OllamaService();
    this.api = new ApiService();
    this.isRunning = false;
    this.stats = {
      gpu: null,
      ram: null,
      cpu: null,
      tasksCompleted: 0,
      earnings: 0,
    };
  }

  async start() {
    this.isRunning = true;
    await this.getSystemInfo();
    this.reportStats();
    console.log('Mining started');
  }

  async stop() {
    this.isRunning = false;
    console.log('Mining stopped');
  }

  async getSystemInfo() {
    try {
      const cpu = await si.cpu();
      const mem = await si.mem();
      
      this.stats.cpu = {
        model: cpu.brand,
        cores: cpu.cores,
        usage: await si.currentLoad(),
      };
      
      this.stats.ram = {
        total: mem.total,
        used: mem.used,
        free: mem.free,
      };
    } catch (error) {
      console.error('Error getting system info:', error);
    }
  }

  async reportStats() {
    if (!this.isRunning) return;

    try {
      await this.api.heartbeat({
        status: 'online',
        gpu_usage: this.stats.cpu?.usage?.currentLoad || 0,
        ram_usage: (this.stats.ram?.used / this.stats.ram?.total) * 100 || 0,
        tasks_completed: this.stats.tasksCompleted,
      });
    } catch (error) {
      console.error('Error reporting stats:', error);
    }

    setTimeout(() => this.reportStats(), 60000);
  }

  async processTask(task) {
    try {
      const result = await this.ollama.generate(task.prompt);
      this.stats.tasksCompleted++;
      return result;
    } catch (error) {
      throw new Error('Failed to process task');
    }
  }

  getStats() {
    return this.stats;
  }
}

module.exports = MinerService;
