const MODELS = [
  // Chat — Kamel-tarin
  { id: 'llama3.3:70b', name: 'Llama 3.3', size: '70B', ram: '43 GB', category: 'chat', desc: 'Best large model (MMLU 86.0)', inputPrice: 0.097, outputPrice: 0.194, vision: false, audio: false },
  { id: 'deepseek-r1:70b', name: 'DeepSeek R1', size: '70B', ram: '43 GB', category: 'chat', desc: 'Best reasoning model', inputPrice: 0.098, outputPrice: 0.196, vision: false, audio: false },
  { id: 'qwen3:32b', name: 'Qwen 3', size: '32B', ram: '20 GB', category: 'chat', desc: 'Strong reasoning with thinking modes', inputPrice: 0.095, outputPrice: 0.190, vision: false, audio: false },
  { id: 'gpt-oss:20b', name: 'GPT-OSS 20B', size: '21B MoE', ram: '14 GB', category: 'chat', desc: 'OpenAI open-weight (Harmony format)', inputPrice: 0.088, outputPrice: 0.176, vision: false, audio: false },
  { id: 'phi4:14b', name: 'Phi-4', size: '14B', ram: '9 GB', category: 'chat', desc: 'Best small reasoner (math + logic)', inputPrice: 0.086, outputPrice: 0.172, vision: false, audio: false },
  { id: 'llama3.1:8b', name: 'Llama 3.1', size: '8B', ram: '5 GB', category: 'chat', desc: 'Best budget all-rounder', inputPrice: 0.079, outputPrice: 0.158, vision: false, audio: false },
  { id: 'llama3.2:3b', name: 'Llama 3.2', size: '3B', ram: '2 GB', category: 'chat', desc: 'Fastest everyday chat', inputPrice: 0.071, outputPrice: 0.142, vision: false, audio: false },

  // Code — Kamel-tarin
  { id: 'qwen3-coder:30b', name: 'Qwen 3 Coder', size: '30B MoE', ram: '18 GB', category: 'code', desc: 'Best coding model (256K context)', inputPrice: 0.091, outputPrice: 0.182, vision: false, audio: false },
  { id: 'qwen2.5-coder:32b', name: 'Qwen 2.5 Coder', size: '32B', ram: '20 GB', category: 'code', desc: 'Best dense coder (92.7% HumanEval)', inputPrice: 0.094, outputPrice: 0.188, vision: false, audio: false },

  // Vision — Kamel-tarin
  { id: 'gemma3:27b', name: 'Gemma 3', size: '27B', ram: '18 GB', category: 'vision', desc: 'Google multimodal workhorse', inputPrice: 0.092, outputPrice: 0.184, vision: true, audio: false },
  { id: 'mistral-small3.2:24b', name: 'Mistral Small 3.2', size: '24B', ram: '15 GB', category: 'vision', desc: 'Fast vision + tools (EU-made)', inputPrice: 0.090, outputPrice: 0.180, vision: true, audio: false },
  { id: 'qwen3-vl:8b', name: 'Qwen 3 VL', size: '8B', ram: '8 GB', category: 'vision', desc: 'Best vision model (tools + thinking)', inputPrice: 0.082, outputPrice: 0.164, vision: true, audio: false },
  { id: 'gemma4:12b', name: 'Gemma 4', size: '12B', ram: '7 GB', category: 'vision', desc: 'Multimodal + tools + thinking', inputPrice: 0.085, outputPrice: 0.170, vision: true, audio: true },

  // Embedding — Kamel-tarin
  { id: 'embeddinggemma', name: 'EmbeddingGemma', size: '300M', ram: '0.5 GB', category: 'embedding', desc: 'Newest (100+ languages, Matryoshka)', inputPrice: 0.073, outputPrice: 0.146, vision: false, audio: false },
  { id: 'nomic-embed-text', name: 'Nomic Embed', size: '274M', ram: '0.3 GB', category: 'embedding', desc: 'Classic default for RAG', inputPrice: 0.07, outputPrice: 0.14, vision: false, audio: false },
  { id: 'bge-m3', name: 'BGE-M3', size: '567M', ram: '1.2 GB', category: 'embedding', desc: 'Multilingual + long-document RAG', inputPrice: 0.076, outputPrice: 0.152, vision: false, audio: false },
];

module.exports = MODELS;
