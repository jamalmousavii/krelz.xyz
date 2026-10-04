// Phase 5 (v3.35.0) — F13: /api/stats/network powers the public explorer:
// summary stats (incl. completed_tasks + platform_revenue) plus the rows its
// transactions/miners tabs render. Before this the response carried only
// stats, so both tabs were permanently empty and the stats tab showed `--`.

jest.mock('../src/database/pool', () => {
  const state = {
    statements: [],
    queryImpl: async () => ({ rows: [] }),
  };
  return {
    __state: state,
    query: (sql, params) => {
      state.statements.push(String(sql).replace(/\s+/g, ' ').trim());
      return state.queryImpl(sql, params);
    },
    connect: async () => { throw new Error('connect not used'); },
  };
});

const request = require('supertest');
const express = require('express');
const pool = require('../src/database/pool');
const statsRouter = require('../src/routes/stats');

function app() {
  const a = express();
  a.use('/api/stats', statsRouter);
  return a;
}

const MINERS = { rows: [{ total: '7', online: '3' }] };
const TOTALS = {
  rows: [{
    total_users: '11',
    total_requests: '42',
    completed_tasks: '37',
    total_cost: '12.5',
    platform_revenue: '1.25',
  }],
};
const TASKS = {
  rows: [{ id: 5, user_id: 1, miner_id: 2, tokens_used: 100, cost: 0.1, status: 'completed', created_at: '2026-10-04T00:00:00Z' }],
};
const TOP = {
  rows: [{ id: 2, gpu_model: 'RTX 3060', wallet_address: 'kz_abc', status: 'online', total_tasks: 9, earnings: 4.5 }],
};

function scriptQueries() {
  let i = 0;
  const results = [MINERS, TOTALS, TASKS, TOP];
  return async () => results[i++] || { rows: [] };
}

describe('GET /api/stats/network', () => {
  beforeEach(() => {
    pool.__state.statements.length = 0;
    pool.__state.queryImpl = scriptQueries();
  });

  it('returns stats plus the explorer rows', async () => {
    const res = await request(app()).get('/api/stats/network');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats).toMatchObject({
      total_miners: 7,
      active_miners: 3,
      total_users: 11,
      total_requests: 42,
      completed_tasks: 37,
      total_cost: 12.5,
      platform_revenue: 1.25,
    });
    expect(res.body.recent_tasks).toHaveLength(1);
    expect(res.body.recent_tasks[0]).toMatchObject({ id: 5, status: 'completed' });
    expect(res.body.top_miners).toHaveLength(1);
    expect(res.body.top_miners[0]).toMatchObject({ gpu_model: 'RTX 3060', status: 'online' });
  });

  it('asks for the newest tasks first and a bounded miner list', async () => {
    await request(app()).get('/api/stats/network');
    const sql = pool.__state.statements.join('\n');
    expect(sql).toMatch(/FROM tasks\s+ORDER BY id DESC\s+LIMIT 50/);
    expect(sql).toMatch(/FROM miners\s+WHERE status IS NULL OR status != 'removed'\s+ORDER BY COALESCE\(total_tasks, 0\) DESC, id ASC\s+LIMIT 10/);
    // 'removed' miners stay out of the public lists entirely
    expect((sql.match(/status != 'removed'/g) || []).length).toBe(2);
  });

  it('500s with a JSON error when the query layer fails', async () => {
    pool.__state.queryImpl = async () => { throw new Error('db down'); };
    const res = await request(app()).get('/api/stats/network');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Server error');
  });
});
