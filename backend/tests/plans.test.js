const {
  FREE_DAILY_TOKENS,
  PLUS_DAILY_TOKENS,
  PLUS_PRICE_USD,
  PLUS_INTERVAL_DAYS,
  getActivePlan,
  getDailyCap,
  activatePlus,
} = require('../src/services/plans');
const nowpayments = require('../src/services/nowpayments');

describe('plan constants (market positioning)', () => {
  it('gives Free twice the best market free tier (Cerebras 1M/day)', () => {
    expect(FREE_DAILY_TOKENS).toBe(2000000);
  });

  it('gives Plus five times the Free allowance', () => {
    expect(PLUS_DAILY_TOKENS).toBe(10000000);
    expect(PLUS_DAILY_TOKENS).toBe(FREE_DAILY_TOKENS * 5);
  });

  it('prices Plus so a handful of subscribers cover the server', () => {
    expect(PLUS_PRICE_USD).toBe(6.99);
    expect(PLUS_INTERVAL_DAYS).toBe(30);
  });
});

function makeClient(...responses) {
  const statements = [];
  let i = 0;
  return {
    statements,
    query: jest.fn(async (sql) => {
      statements.push(sql.trim().replace(/\s+/g, ' '));
      const resp = responses[Math.min(i, responses.length - 1)];
      i += 1;
      return resp;
    }),
  };
}

describe('getActivePlan / getDailyCap', () => {
  it('returns the Plus cap for an active subscriber', async () => {
    const client = makeClient({ rows: [{ plan_type: 'plus', expires_at: new Date(Date.now() + 86400000) }] });
    const cap = await getDailyCap(7, client);

    expect(cap).toBe(PLUS_DAILY_TOKENS);
  });

  it('returns the Free cap when no plan row exists', async () => {
    const client = makeClient({ rows: [] });
    const cap = await getDailyCap(7, client);

    expect(cap).toBe(FREE_DAILY_TOKENS);
  });

  it('never queries for a guest (no userId)', async () => {
    const client = makeClient();
    const cap = await getDailyCap(null, client);

    expect(cap).toBe(FREE_DAILY_TOKENS);
    expect(client.query).not.toHaveBeenCalled();
  });

  it('only counts plans that are active and unexpired', async () => {
    const client = makeClient({ rows: [] });
    await getActivePlan(7, client);

    const sql = client.statements[0];
    expect(sql).toContain(`status = 'active'`);
    expect(sql).toContain('expires_at > now()');
  });
});

describe('activatePlus (renewal extends from the later of now/expiry)', () => {
  it('inserts fresh or extends an existing plan by exactly the interval', async () => {
    const client = makeClient({ rows: [] });
    await activatePlus(7, client);

    const sql = client.statements[0];
    expect(sql).toContain(`INSERT INTO user_plans`);
    expect(sql).toContain(`ON CONFLICT (user_id, plan_type) DO UPDATE`);
    expect(sql).toContain('GREATEST');
    expect(sql).toContain(`interval '1 day'`);
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it('extends a still-valid plan from its expiry, not from now', async () => {
    const client = makeClient({ rows: [] });
    await activatePlus(7, client);

    // GREATEST(expires_at, now) + 30d — a mid-cycle renewal never loses days.
    expect(client.statements[0]).toContain('GREATEST(COALESCE(user_plans.expires_at, now()), now())');
  });
});

describe('NowPayments order ids carry the purchase type', () => {
  it('parses a Plus order id back to the subscribing user', async () => {
    const result = await nowpayments.processIPN({
      order_id: 'plus-7-1700000000',
      payment_status: 'finished',
      price_amount: PLUS_PRICE_USD,
      pay_amount: 0.001,
    });

    expect(result.success).toBe(true);
    expect(result.userId).toBe(7);
    expect(result.amount).toBe(PLUS_PRICE_USD);
    expect(result.orderId).toBe('plus-7-1700000000');
  });

  it('still parses legacy deposit order ids', async () => {
    const result = await nowpayments.processIPN({
      order_id: 'krelz-7-1700000000',
      payment_status: 'finished',
      price_amount: 25,
    });

    expect(result.userId).toBe(7);
    expect(result.amount).toBe(25);
  });

  it('does not claim unfinished payments', async () => {
    const result = await nowpayments.processIPN({
      order_id: 'plus-7-1700000000',
      payment_status: 'waiting',
      price_amount: PLUS_PRICE_USD,
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('waiting');
  });

  // Regression (v3.27.0): the webhook used to also require
  // `result.status === 'finished'`, but the success branch normalizes to
  // 'completed' — so every finished IPN (deposit and Plus) was ignored.
  it('marks finished payments success with normalized status completed', async () => {
    const result = await nowpayments.processIPN({
      order_id: 'plus-7-1700000000',
      payment_status: 'finished',
      price_amount: PLUS_PRICE_USD,
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('completed');
  });
});
