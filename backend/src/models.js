const MODELS = [
  // Chat — Kamel-tarin
  { id: 'qwen3.6:27b', name: 'Qwen 3.6', size: '27B', ram: '17 GB', category: 'chat', desc: 'Best overall single-GPU model (68.9% SWE-bench)' },
  { id: 'llama3.3:70b', name: 'Llama 3.3', size: '70B', ram: '43 GB', category: 'chat', desc: 'Best large model (MMLU 86.0)' },
  { id: 'deepseek-r1:70b', name: 'DeepSeek R1', size: '70B', ram: '43 GB', category: 'chat', desc: 'Best reasoning model' },
  { id: 'llama3.1:8b', name: 'Llama 3.1', size: '8B', ram: '5 GB', category: 'chat', desc: 'Best budget all-rounder' },

  // Code — Kamel-tarin
  { id: 'qwen3-coder:30b', name: 'Qwen 3 Coder', size: '30B MoE', ram: '18 GB', category: 'code', desc: 'Best coding model (256K context)' },
  { id: 'qwen2.5-coder:32b', name: 'Qwen 2.5 Coder', size: '32B', ram: '20 GB', category: 'code', desc: 'Best dense coder (92.7% HumanEval)' },

  // Vision — Kamel-tarin
  { id: 'qwen3-vl:8b', name: 'Qwen 3 VL', size: '8B', ram: '8 GB', category: 'vision', desc: 'Best vision model (tools + thinking)' },
  { id: 'gemma4:12b', name: 'Gemma 4', size: '12B', ram: '7 GB', category: 'vision', desc: 'Multimodal + tools + thinking' },

  // Embedding — Kamel-tarin
  { id: 'embeddinggemma', name: 'EmbeddingGemma', size: '300M', ram: '0.5 GB', category: 'embedding', desc: 'Newest (100+ languages, Matryoshka)' },
  { id: 'nomic-embed-text', name: 'Nomic Embed', size: '274M', ram: '0.3 GB', category: 'embedding', desc: 'Classic default for RAG' },
  { id: 'bge-m3', name: 'BGE-M3', size: '567M', ram: '1.2 GB', category: 'embedding', desc: 'Multilingual + long-document RAG' },
];

module.exports = MODELS;
