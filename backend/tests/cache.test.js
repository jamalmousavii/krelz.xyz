const { isCacheableRequest, getCacheStats } = require('../src/cache');

const base = { method: 'GET', headers: {}, originalUrl: '/api/plans' };

describe('cache key safety', () => {
  it('never caches an authenticated request', () => {
    expect(isCacheableRequest({ ...base, headers: { authorization: 'Bearer abc' } })).toBe(false);
    expect(isCacheableRequest({ ...base, user: { id: 1 } })).toBe(false);
  });

  it('never caches non-GET requests', () => {
    expect(isCacheableRequest({ ...base, method: 'POST' })).toBe(false);
    expect(isCacheableRequest({ ...base, method: 'PUT' })).toBe(false);
  });

  it('caches plain anonymous GETs', () => {
    expect(isCacheableRequest(base)).toBe(true);
  });

  it('reports the cache as disabled in the test suite', () => {
    expect(getCacheStats().connected).toBe(false);
  });
});
