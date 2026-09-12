const axios = require('axios');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class OllamaService {
  constructor() {
    this.url = 'http://localhost:11434';
    this.model = 'llama3:8b';
    this.isRunning = false;
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

  async generate(prompt) {
    try {
      const response = await axios.post(`${this.url}/api/generate`, {
        model: this.model,
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
