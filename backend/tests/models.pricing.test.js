const MODELS = require('../src/models');
const chat = require('../src/routes/chat');

describe('model catalog', () => {
  it('has unique ids', () => {
    const ids = MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('prices every model with non-negative numbers', () => {
    for (const m of MODELS) {
      expect(typeof m.inputPrice).toBe('number');
      expect(typeof m.outputPrice).toBe('number');
      expect(m.inputPrice).toBeGreaterThanOrEqual(0);
      expect(m.outputPrice).toBeGreaterThanOrEqual(0);
    }
  });

  it('contains only ids that can actually be pulled from Ollama', () => {
    // Regression: a menu/catalog entry for a model that does not exist made
    // miners advertise a model the dispatcher could never route to.
    const allowed = new Set([
      'free-cloud-ai', 'llama3.1:8b', 'llama3.3:70b', 'deepseek-r1:70b',
      'qwen3-coder:30b', 'qwen2.5-coder:32b', 'qwen3-vl:8b', 'gemma4:12b',
      'embeddinggemma', 'nomic-embed-text', 'bge-m3',
    ]);
    for (const m of MODELS) {
      expect(allowed.has(m.id)).toBe(true);
    }
  });

  it('exposes a default model that exists in the catalog', () => {
    expect(MODELS.some((m) => m.id === chat.DEFAULT_MODEL)).toBe(true);
  });
});

describe('chat pricing', () => {
  it('uses the catalog price for a known model', () => {
    const m = MODELS.find((x) => x.id === 'llama3.1:8b');
    expect(chat.getModelPricing('llama3.1:8b')).toEqual({
      inputPrice: m.inputPrice,
      outputPrice: m.outputPrice,
    });
  });

  it('falls back to a conservative price for an unknown model', () => {
    const pricing = chat.getModelPricing('does-not-exist:99b');
    expect(pricing.outputPrice).toBeGreaterThan(0);
  });

  it('keeps the revenue split and free allowance as documented', () => {
    expect(chat.MINER_REVENUE_SHARE).toBe(0.9);
    expect(chat.FREE_DAILY_TOKEN_VALUE).toBe(0.001);
  });
});

describe('daily allowance date keys', () => {
  it('produces a YYYY-MM-DD key', () => {
    expect(chat.todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('normalises string dates (pg DATE after the pool parser fix)', () => {
    expect(chat.toDateKey('2026-09-26')).toBe('2026-09-26');
  });

  it('normalises Date values pinned to LOCAL midnight without shifting the day', () => {
    // This is the regression behind the "daily tokens reset on every request"
    // bug: toISOString() moved a local-midnight Date back to the previous day.
    const localMidnight = new Date(2026, 8, 26, 0, 0, 0); // 2026-09-26 local
    expect(chat.toDateKey(localMidnight)).toBe('2026-09-26');
  });

  it('treats a Date and its string form as the same day', () => {
    const date = new Date(2026, 0, 1, 12, 0, 0);
    expect(chat.toDateKey(date)).toBe(chat.toDateKey('2026-01-01'));
  });

  it('returns null for empty values', () => {
    expect(chat.toDateKey(null)).toBeNull();
    expect(chat.toDateKey(undefined)).toBeNull();
    expect(chat.toDateKey('')).toBeNull();
  });
});
