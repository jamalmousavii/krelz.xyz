// Shared model-list helpers (v3.40.0): miner-count sorting + category
// grouping, used by the chat composer, the /miner page and the
// MODEL_UNAVAILABLE alternatives. Array.prototype.sort is stable (ES2019+),
// so ties keep catalog order.

export const CATEGORY_ORDER = ['chat', 'code', 'vision', 'embedding'];

export const CATEGORY_ICONS = { chat: '💬', code: '💻', vision: '👁️', embedding: '🔗' };

// i18n keys for the group headers (chat.catChat / catCode / catVision / catEmbedding).
export const CATEGORY_I18N_KEY = {
  chat: 'chat.catChat',
  code: 'chat.catCode',
  vision: 'chat.catVision',
  embedding: 'chat.catEmbedding',
};

export function minerCount(m) {
  return Number(m && m.miners_online) || 0;
}

// Busiest model first; ties keep their relative (catalog) order.
export function sortModels(models) {
  return [...(models || [])].sort((a, b) => minerCount(b) - minerCount(a));
}

// [{ category, items }] in CATEGORY_ORDER (unknown categories last).
// Inside a group: online first (count desc), then offline.
export function groupModels(models) {
  const byCat = new Map();
  for (const m of models || []) {
    const cat = (m && m.category) || 'other';
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat).push(m);
  }
  const ordered = [
    ...CATEGORY_ORDER.filter((c) => byCat.has(c)),
    ...[...byCat.keys()].filter((c) => !CATEGORY_ORDER.includes(c)),
  ];
  return ordered.map((category) => ({
    category,
    items: byCat.get(category).sort((a, b) => {
      const onA = minerCount(a) > 0 ? 0 : 1;
      const onB = minerCount(b) > 0 ? 0 : 1;
      return onA - onB || minerCount(b) - minerCount(a);
    }),
  }));
}

// First model with miners online (for auto-switch + default picks).
export function topOnlineModel(models) {
  const sorted = sortModels(models);
  return sorted.find((m) => minerCount(m) > 0) || null;
}
