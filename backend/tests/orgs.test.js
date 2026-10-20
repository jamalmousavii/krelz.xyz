// Org plans v3.44.0: shared leader bucket, member management, usage.
// v3.45.0: org mutations run inside transactions (client from pool.connect)
// and addMember races land on the partial-unique DB index — the mock below
// routes every client query through the same scripted queryImpl as pool.query.

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../src/database/pool', () => {
  const state = {
    queryImpl: async () => ({ rows: [] }),
    connectImpl: async () => { throw new Error('connectImpl not scripted'); },
  };
  return {
    __state: state,
    query: (sql, params) => state.queryImpl(sql, params),
    connect: () => state.connectImpl(),
  };
});

const pool = require('../src/database/pool');
const orgRoutes = require('../src/routes/orgs');
const { resolveCap } = require('../src/services/org');

const SECRET = process.env.JWT_SECRET;
const sign = (id = 7) => jwt.sign({ id, role: 'user', token_version: 0 }, SECRET, {
  algorithm: 'HS256',
  expiresIn: '1h',
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/orgs', orgRoutes);
  return app;
}

beforeEach(() => {
  pool.__state.queryImpl = async () => ({ rows: [] });
  pool.__state.connectImpl = async () => { throw new Error('connectImpl not scripted'); };
});

// Client whose queries flow through the same scripted queryImpl (BEGIN/COMMIT
// included) so transaction-based routes stay fully mockable.
function scriptedClient() {
  pool.__state.connectImpl = async () => ({
    query: (sql, params) => pool.__state.queryImpl(sql, params),
    release: jest.fn(),
  });
}

function authDb() {
  const prev = pool.__state.queryImpl;
  pool.__state.queryImpl = async (sql, params) => {
    if (String(sql).includes('token_version')) return { rows: [{ token_version: 0, banned: false }] };
    return prev(sql, params);
  };
}

describe('resolveCap (shared bucket, max rule)', () => {
  const plans = require('../src/services/plans');

  it('member drains the leader bucket when the org plan wins', async () => {
    pool.__state.queryImpl = async (sql, params) => {
      if (String(sql).includes('FROM org_members') && String(sql).includes('m.user_id')) {
        return { rows: [{ id: 1, name: 'Acme', leader_user_id: 9, role: 'member' }] };
      }
      if (String(sql).includes('FROM user_plans')) {
        // own plan: none for member (params[0]=7), plus for leader (9)
        if (params && params[0] === 9) return { rows: [{ plan_type: 'plus', expires_at: '2999-01-01' }] };
        return { rows: [] };
      }
      return { rows: [] };
    };
    const r = await resolveCap(7, null);
    expect(r.cap).toBe(plans.PLANS.plus.daily_tokens);
    expect(r.bucketUserId).toBe(9);
    expect(r.org.id).toBe(1);
  });

  it('own bigger plan wins over the org (never downgrades)', async () => {
    pool.__state.queryImpl = async (sql, params) => {
      if (String(sql).includes('FROM org_members')) {
        return { rows: [{ id: 1, name: 'Acme', leader_user_id: 9, role: 'member' }] };
      }
      if (String(sql).includes('FROM user_plans')) {
        if (params && params[0] === 7) return { rows: [{ plan_type: 'max', expires_at: '2999-01-01' }] };
        if (params && params[0] === 9) return { rows: [{ plan_type: 'plus', expires_at: '2999-01-01' }] };
        return { rows: [] };
      }
      return { rows: [] };
    };
    const r = await resolveCap(7, null);
    expect(r.cap).toBe(plans.PLANS.max.daily_tokens);
    expect(r.bucketUserId).toBe(7);
  });

  it('no org → own cap, own bucket; guest → free cap, no bucket', async () => {
    pool.__state.queryImpl = async (sql, params) => {
      if (String(sql).includes('FROM org_members')) return { rows: [] };
      if (String(sql).includes('FROM user_plans')) return { rows: [] };
      return { rows: [] };
    };
    const solo = await resolveCap(7, null);
    expect(solo.cap).toBe(plans.FREE_DAILY_TOKENS);
    expect(solo.bucketUserId).toBe(7);
    const guest = await resolveCap(null, '1.2.3.4');
    expect(guest.cap).toBe(plans.FREE_DAILY_TOKENS);
    expect(guest.bucketUserId).toBeNull();
  });
});

describe('org member routes', () => {
  const app = buildApp();

  function memberDb() {
    authDb();
    const prev = pool.__state.queryImpl;
    pool.__state.queryImpl = async (sql, params) => {
      if (String(sql).includes('FROM org_members') && String(sql).includes('m.user_id')) {
        return { rows: [{ id: 1, name: 'Acme', leader_user_id: 9, role: 'leader' }] };
      }
      return prev(sql, params);
    };
  }

  it('leader adds a registered user by email; unknown email 404s', async () => {
    memberDb();
    scriptedClient();
    const prev = pool.__state.queryImpl;
    pool.__state.queryImpl = async (sql, params) => {
      if (String(sql).includes('FROM orgs WHERE id')) return { rows: [{ status: 'active' }] };
      if (String(sql).includes('FROM users WHERE email')) return { rows: [{ id: 8 }] };
      return prev(sql, params);
    };
    const ok = await request(app).post('/api/orgs/members')
      .set('Authorization', `Bearer ${sign(7)}`).send({ email: 'new@x.co' });
    expect(ok.status).toBe(201);

    pool.__state.queryImpl = async (sql, params) => {
      if (String(sql).includes('FROM orgs WHERE id')) return { rows: [{ status: 'active' }] };
      if (String(sql).includes('FROM users WHERE email')) return { rows: [] };
      return prev(sql, params);
    };
    const miss = await request(app).post('/api/orgs/members')
      .set('Authorization', `Bearer ${sign(7)}`).send({ email: 'ghost@x.co' });
    expect(miss.status).toBe(404);
  });

  it('duplicate active membership maps the unique-index violation to a 400', async () => {
    memberDb();
    scriptedClient();
    const prev = pool.__state.queryImpl;
    pool.__state.queryImpl = async (sql, params) => {
      if (String(sql).includes('FROM orgs WHERE id')) return { rows: [{ status: 'active' }] };
      if (String(sql).includes('FROM users WHERE email')) return { rows: [{ id: 8 }] };
      if (String(sql).includes('INSERT INTO org_members')) {
        const err = new Error('duplicate key value violates unique constraint "uniq_org_members_active_user"');
        err.code = '23505';
        throw err;
      }
      return prev(sql, params);
    };
    const res = await request(app).post('/api/orgs/members')
      .set('Authorization', `Bearer ${sign(7)}`).send({ email: 'busy@x.co' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/active org/);
  });

  it('non-leader cannot add (403) and leader cannot remove self (400)', async () => {
    authDb();
    const prev = pool.__state.queryImpl;
    pool.__state.queryImpl = async (sql) => {
      if (String(sql).includes('FROM org_members') && String(sql).includes('m.user_id')) {
        return { rows: [{ id: 1, name: 'Acme', leader_user_id: 9, role: 'member' }] };
      }
      return prev(sql);
    };
    const add = await request(app).post('/api/orgs/members')
      .set('Authorization', `Bearer ${sign(7)}`).send({ email: 'a@x.co' });
    expect(add.status).toBe(403);

    pool.__state.queryImpl = async (sql) => {
      if (String(sql).includes('FROM org_members') && String(sql).includes('m.user_id')) {
        return { rows: [{ id: 1, name: 'Acme', leader_user_id: 7, role: 'leader' }] };
      }
      return prev(sql);
    };
    const self = await request(app).delete('/api/orgs/members/7')
      .set('Authorization', `Bearer ${sign(7)}`);
    expect(self.status).toBe(400);
  });

  it('usage: leader sees all, member sees self', async () => {
    authDb();
    const prev = pool.__state.queryImpl;
    const rows = [
      { id: 7, email: 'l@x.co', role: 'leader', joined_at: 'x', tokens: 5, messages: 1, cost: 0.1 },
      { id: 8, email: 'm@x.co', role: 'member', joined_at: 'x', tokens: 9, messages: 2, cost: 0.2 },
    ];
    pool.__state.queryImpl = async (sql) => {
      if (String(sql).includes('LEFT JOIN tasks')) return { rows };
      if (String(sql).includes('FROM org_members') && String(sql).includes('m.user_id')) {
        return { rows: [{ id: 1, name: 'Acme', leader_user_id: 7, role: 'leader' }] };
      }
      return prev(sql);
    };
    const res = await request(app).get('/api/orgs/usage').set('Authorization', `Bearer ${sign(7)}`);
    expect(res.status).toBe(200);
    expect(res.body.usage).toHaveLength(2);
  });

  it('leaving leader promotes the oldest member (one transaction)', async () => {
    authDb();
    scriptedClient();
    const prev = pool.__state.queryImpl;
    const seen = [];
    pool.__state.queryImpl = async (sql, params) => {
      seen.push(String(sql).split('\n')[0].trim());
      if (String(sql).includes('FROM org_members') && String(sql).includes('m.user_id')) {
        return { rows: [{ id: 1, name: 'Acme', leader_user_id: 7, role: 'leader' }] };
      }
      if (String(sql).includes('FROM orgs WHERE id')) {
        return { rows: [{ leader_user_id: 7, status: 'active' }] };
      }
      if (String(sql).includes('ORDER BY joined_at ASC LIMIT 1')) return { rows: [{ user_id: 8 }] };
      return prev(sql, params);
    };
    const res = await request(app).post('/api/orgs/leave').set('Authorization', `Bearer ${sign(7)}`);
    expect(res.status).toBe(200);
    expect(seen.join('|')).toMatch(/BEGIN/);
    expect(seen.join('|')).toMatch(/UPDATE orgs SET leader_user_id/);
    expect(seen.join('|')).toMatch(/COMMIT/);
  });

  it('transfer runs in a transaction under the org lock', async () => {
    authDb();
    scriptedClient();
    const prev = pool.__state.queryImpl;
    const seen = [];
    pool.__state.queryImpl = async (sql, params) => {
      seen.push(String(sql).split('\n')[0].trim());
      if (String(sql).includes('FROM org_members') && String(sql).includes('m.user_id')) {
        return { rows: [{ id: 1, name: 'Acme', leader_user_id: 7, role: 'leader' }] };
      }
      if (String(sql).includes('FROM orgs WHERE id')) {
        return { rows: [{ leader_user_id: 7, status: 'active' }] };
      }
      if (String(sql).includes('FROM org_members WHERE org_id')) return { rows: [{ user_id: 8 }] };
      return prev(sql, params);
    };
    const res = await request(app)
      .post('/api/orgs/transfer')
      .set('Authorization', `Bearer ${sign(7)}`)
      .send({ user_id: 8 });
    expect(res.status).toBe(200);
    expect(res.body.leader).toBe(8);
    expect(seen.join('|')).toMatch(/FOR UPDATE/);
    expect(seen.join('|')).toMatch(/UPDATE orgs SET leader_user_id/);
  });
});
