const crypto = require('crypto');
const nowpayments = require('../src/services/nowpayments');

const SECRET = process.env.NOWPAYMENTS_IPN_SECRET;

// Mirrors the server-side canonicalisation: keys sorted, then JSON.stringify.
function sign(payload) {
  const sorted = Object.keys(payload)
    .sort()
    .reduce((acc, key) => {
      acc[key] = payload[key];
      return acc;
    }, {});
  return crypto.createHmac('sha512', SECRET).update(JSON.stringify(sorted)).digest('hex');
}

const payload = {
  payment_id: 12345,
  payment_status: 'finished',
  price_amount: 25,
  price_currency: 'usd',
  pay_amount: 0.001,
  order_id: 'krelz-7-1700000000',
};

describe('NowPayments IPN verification (fail closed)', () => {
  it('accepts a correctly signed payload', () => {
    expect(nowpayments.verifyIPN(payload, sign(payload))).toBe(true);
  });

  it('rejects a payload signed with the wrong secret', () => {
    const forged = crypto.createHmac('sha512', 'attacker-secret').update(JSON.stringify(payload)).digest('hex');
    expect(nowpayments.verifyIPN(payload, forged)).toBe(false);
  });

  it('rejects a tampered amount even with a real signature', () => {
    const signature = sign(payload);
    expect(nowpayments.verifyIPN({ ...payload, price_amount: 1000000 }, signature)).toBe(false);
  });

  it('rejects a missing signature', () => {
    expect(nowpayments.verifyIPN(payload, undefined)).toBe(false);
    expect(nowpayments.verifyIPN(payload, '')).toBe(false);
  });

  it('rejects a signature of a different length without throwing', () => {
    expect(nowpayments.verifyIPN(payload, 'deadbeef')).toBe(false);
  });
});
