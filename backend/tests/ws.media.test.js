const WSServer = require('../src/ws');

// findMinerForModel / minerSupportsMedia are plain logic on the miner map —
// build a bare instance so no HTTP server or socket is needed.
function makeServer(miners) {
  const ws = Object.create(WSServer.prototype);
  ws.miners = new Map();
  ws.taskCallbacks = new Map();
  miners.forEach((m, i) => ws.miners.set(m.id || i + 1, m));
  return ws;
}

// Settle a dispatchTask promise without waiting for the 180s timeout.
async function settle(ws, taskId) {
  const cb = ws.taskCallbacks.get(taskId);
  clearTimeout(cb.timeout);
  ws.taskCallbacks.delete(taskId);
  cb.resolve({ response: 'ok' });
}

const online = (over = {}) => ({
  status: 'online',
  current_model: 'llama3.1:8b',
  app_version: null,
  ...over,
});

describe('findMinerForModel media gating (v3.20.0)', () => {
  it('routes media to any miner advertising >= 3.20.0', () => {
    const ws = makeServer([online({ app_version: '3.20.0' })]);
    expect(ws.findMinerForModel('llama3.1:8b', true)).toEqual({ minerId: 1, model: 'llama3.1:8b' });
  });

  it('never routes media to miners without a version (old binaries)', () => {
    const ws = makeServer([online({ app_version: null })]);
    expect(ws.findMinerForModel('llama3.1:8b', true)).toBeNull();
  });

  it('never routes media to pre-3.20.0 miners', () => {
    for (const v of ['3.19.1', '3.0.0', '2.99.9', 'v3.19.0']) {
      const ws = makeServer([online({ app_version: v })]);
      expect(ws.findMinerForModel('llama3.1:8b', true)).toBeNull();
    }
  });

  it('handles future major/minor versions', () => {
    for (const v of ['4.0.0', '3.21.0', 'v3.20.5']) {
      const ws = makeServer([online({ app_version: v })]);
      expect(ws.findMinerForModel('llama3.1:8b', true)).not.toBeNull();
    }
  });

  it('still serves text tasks to old miners', () => {
    const ws = makeServer([online({ app_version: '3.19.1' })]);
    expect(ws.findMinerForModel('llama3.1:8b', false)).toEqual({ minerId: 1, model: 'llama3.1:8b' });
    expect(ws.findMinerForModel('llama3.1:8b')).not.toBeNull();
  });

  it('never substitutes another model (v3.40.0 exact-model rule)', () => {
    const ws = makeServer([
      online({ id: 1, app_version: '3.20.0', current_model: 'other' }),
      online({ id: 2, app_version: '3.19.1', current_model: 'llama3.1:8b' }),
    ]);
    // miner 2 matches the model but is too old, miner 1 is new but holds a
    // different model → no substitution, caller gets MODEL_UNAVAILABLE.
    expect(ws.findMinerForModel('llama3.1:8b', true)).toBeNull();
  });

  it('ignores offline miners even when new enough', () => {
    const ws = makeServer([online({ status: 'offline', app_version: '3.20.0' })]);
    expect(ws.findMinerForModel('llama3.1:8b', true)).toBeNull();
  });
});

describe('findMinersForModel / counts (v3.40.0)', () => {
  it('returns every exact-model miner in registration order', () => {
    const ws = makeServer([
      online({ id: 1, current_model: 'llama3.1:8b' }),
      online({ id: 2, current_model: 'other' }),
      online({ id: 3, current_model: 'llama3.1:8b' }),
    ]);
    expect(ws.findMinersForModel('llama3.1:8b', false)).toEqual([
      { minerId: 1, model: 'llama3.1:8b' },
      { minerId: 3, model: 'llama3.1:8b' },
    ]);
  });

  it('counts usable miners with and without media gating', () => {
    const ws = makeServer([
      online({ id: 1, app_version: '3.20.0' }),
      online({ id: 2, app_version: '3.19.1' }),
      online({ id: 3, status: 'offline', app_version: '3.20.0' }),
    ]);
    expect(ws.countUsableMiners(false)).toBe(2);
    expect(ws.countUsableMiners(true)).toBe(1);
  });

  it('reports online counts per model', () => {
    const ws = makeServer([
      online({ id: 1, app_version: '3.20.0', current_model: 'llama3.1:8b' }),
      online({ id: 2, app_version: '3.20.0', current_model: 'llama3.1:8b' }),
      online({ id: 3, app_version: '3.20.0', current_model: 'other' }),
    ]);
    expect(ws.onlineModelCounts(false)).toEqual({ 'llama3.1:8b': 2, other: 1 });
  });
});

describe('dispatchTask attachment payload', () => {
  const fakeSocket = () => {
    const sent = [];
    return {
      sent,
      ws: { readyState: 1, sent, send: (str) => sent.push(JSON.parse(str)) },
    };
  };

  it('includes media as a plaintext attachment when no e2e key', async () => {
    const miner = { ...online({ app_version: '3.20.0' }), ws: fakeSocket().ws };
    const ws = makeServer([miner]);
    const pending = ws.dispatchTask(1, 99, 'prompt', 'llama3.1:8b', { type: 'image', data: 'AAAA' });
    expect(miner.ws.sent[0].attachment).toEqual({ type: 'image', data: 'AAAA' });
    expect(miner.ws.sent[0].prompt).toBe('prompt');
    // settle so the 180s timeout timer doesn't linger
    await settle(ws, 99);
    await pending;
  });

  it('omits attachment for plain text tasks', async () => {
    const miner = { ...online(), ws: fakeSocket().ws };
    const ws = makeServer([miner]);
    const pending = ws.dispatchTask(1, 100, 'prompt', 'llama3.1:8b', null);
    expect(miner.ws.sent[0]).not.toHaveProperty('attachment');
    await settle(ws, 100);
    await pending;
  });
});
