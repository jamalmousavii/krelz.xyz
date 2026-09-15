const MODELS = [
  // Chat — Kamel-tarin
  { id: 'qwen3.6:27b', name: 'Qwen 3.6', size: '27B', ram: '17 GB', category: 'chat', desc: 'Best overall single-GPU model (68.9% SWE-bench)', inputPrice: 0.088, outputPrice: 0.176 },
  { id: 'llama3.3:70b', name: 'Llama 3.3', size: '70B', ram: '43 GB', category: 'chat', desc: 'Best large model (MMLU 86.0)', inputPrice: 0.097, outputPrice: 0.194 },
  { id: 'deepseek-r1:70b', name: 'DeepSeek R1', size: '70B', ram: '43 GB', category: 'chat', desc: 'Best reasoning model', inputPrice: 0.098, outputPrice: 0.196 },
  { id: 'llama3.1:8b', name: 'Llama 3.1', size: '8B', ram: '5 GB', category: 'chat', desc: 'Best budget all-rounder', inputPrice: 0.079, outputPrice: 0.158 },

  // Code — Kamel-tarin
  { id: 'qwen3-coder:30b', name: 'Qwen 3 Coder', size: '30B MoE', ram: '18 GB', category: 'code', desc: 'Best coding model (256K context)', inputPrice: 0.091, outputPrice: 0.182 },
  { id: 'qwen2.5-coder:32b', name: 'Qwen 2.5 Coder', size: '32B', ram: '20 GB', category: 'code', desc: 'Best dense coder (92.7% HumanEval)', inputPrice: 0.094, outputPrice: 0.188 },

  // Vision — Kamel-tarin
  { id: 'qwen3-vl:8b', name: 'Qwen 3 VL', size: '8B', ram: '8 GB', category: 'vision', desc: 'Best vision model (tools + thinking)', inputPrice: 0.082, outputPrice: 0.164 },
  { id: 'gemma4:12b', name: 'Gemma 4', size: '12B', ram: '7 GB', category: 'vision', desc: 'Multimodal + tools + thinking', inputPrice: 0.085, outputPrice: 0.170 },

  // Embedding — Kamel-tarin
  { id: 'embeddinggemma', name: 'EmbeddingGemma', size: '300M', ram: '0.5 GB', category: 'embedding', desc: 'Newest (100+ languages, Matryoshka)', inputPrice: 0.073, outputPrice: 0.146 },
  { id: 'nomic-embed-text', name: 'Nomic Embed', size: '274M', ram: '0.3 GB', category: 'embedding', desc: 'Classic default for RAG', inputPrice: 0.070, outputPrice: 0.140 },
  { id: 'bge-m3', name: 'BGE-M3', size: '567M', ram: '1.2 GB', category: 'embedding', desc: 'Multilingual + long-document RAG', inputPrice: 0.076, outputPrice: 0.152 },
];

module.exports = MODELS;
