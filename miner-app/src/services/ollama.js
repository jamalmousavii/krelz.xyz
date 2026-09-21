const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class OllamaService {
  constructor(model = 'llama3.1:8b') {
    this.url = 'http://localhost:11434';
    this.model = model;
    this.isRunning = false;
  }

  setModel(model) {
    this.model = model;
  }

  async install() {
    return new Promise((resolve, reject) => {
      const installScript = `
        curl -fsSL https://ollama.com/install.sh | sh
      `;

      exec(installScript, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      });
    });
  }

  async pullModel(modelName) {
    const model = modelName || this.model;
    return new Promise((resolve, reject) => {
      exec(`ollama pull ${model}`, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      });
    });
  }

  async start() {
    // If Ollama already responds, nothing to do.
    try {
      await axios.get(`${this.url}/api/tags`, { timeout: 3000 });
      this.isRunning = true;
      console.log('Ollama already running');
      return;
    } catch (e) {
      // Not running — start it below.
    }

    // NOTE: never use exec('ollama serve &') — the backgrounded child
    // inherits the stdio pipes so exec's callback never fires and the
    // miner hangs forever at "Starting Ollama...". Spawn detached with
    // ignored stdio instead, then poll for readiness.
    const { spawn } = require('child_process');
    try {
      const child = spawn('ollama', ['serve'], { detached: true, stdio: 'ignore' });
      child.unref();
    } catch (err) {
      throw new Error('Failed to start Ollama: ' + err.message);
    }

    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        await axios.get(`${this.url}/api/tags`, { timeout: 2000 });
        this.isRunning = true;
        return;
      } catch (e) {
        // Still starting — keep polling.
      }
    }
    throw new Error('Ollama failed to start (timeout waiting for :11434)');
  }

  async stop() {
    this.isRunning = false;
  }

  async generate(prompt, model) {
    try {
      const response = await axios.post(`${this.url}/api/generate`, {
        model: model || this.model,
        prompt: prompt,
        stream: false,
      });
      return response.data;
    } catch (error) {
      throw new Error('Ollama not available');
    }
  }

  async getStatus() {
    try {
      const response = await axios.get(`${this.url}/api/tags`);
      return {
        running: true,
        models: response.data.models,
      };
    } catch (error) {
      return {
        running: false,
        models: [],
      };
    }
  }
}

module.exports = OllamaService;
