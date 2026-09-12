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
    return new Promise((resolve, reject) => {
      exec('ollama serve &', (error) => {
        if (error) {
          console.log('Ollama may already be running');
        }
        this.isRunning = true;
        resolve();
      });
    });
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
