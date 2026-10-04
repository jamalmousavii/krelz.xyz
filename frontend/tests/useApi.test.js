import { renderHook, waitFor, act } from '@testing-library/react';
import useApi from '../hooks/useApi';

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
});

describe('useApi', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  it('loads data and clears loading on success', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ success: true, items: [1, 2] }));
    const { result } = renderHook(() => useApi('/api/leaderboard'));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({ success: true, items: [1, 2] });
    expect(result.current.error).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe('/api/leaderboard');
  });

  it('flags non-2xx responses as errors', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ error: 'nope' }, { ok: false, status: 500 }));
    const { result } = renderHook(() => useApi('/api/boom'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it('flags body.success === false as an error', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ success: false, error: 'x' }));
    const { result } = renderHook(() => useApi('/api/flag'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it('flags network failures as errors', async () => {
    global.fetch.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useApi('/api/net'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
  });

  it('does not fetch while disabled', async () => {
    const { result } = renderHook(() => useApi('/api/off', { enabled: false }));
    expect(result.current.loading).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('reload refetches and updates data', async () => {
    global.fetch
      .mockResolvedValueOnce(jsonResponse({ success: true, v: 1 }))
      .mockResolvedValueOnce(jsonResponse({ success: true, v: 2 }));
    const { result } = renderHook(() => useApi('/api/v'));

    await waitFor(() => expect(result.current.data).toEqual({ success: true, v: 1 }));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.data).toEqual({ success: true, v: 2 }));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('refetches when deps change', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ success: true }));
    const { rerender } = renderHook(({ page }) => useApi('/api/list', { deps: [page] }), {
      initialProps: { page: 1 },
    });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    rerender({ page: 2 });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    expect(global.fetch.mock.calls[1][0]).toBe('/api/list');
  });

  it('passes fetchOptions through (auth header)', async () => {
    global.fetch.mockResolvedValue(jsonResponse({ success: true }));
    renderHook(() => useApi('/api/me', { fetchOptions: { headers: { Authorization: 'Bearer t' } } }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const opts = global.fetch.mock.calls[0][1];
    expect(opts.headers.Authorization).toBe('Bearer t');
    expect(opts.signal).toBeDefined();
  });

  it('aborts the in-flight request on unmount', async () => {
    let seenSignal;
    global.fetch.mockImplementation((url, opts) => {
      seenSignal = opts.signal;
      return new Promise(() => {}); // never resolves
    });
    const { unmount } = renderHook(() => useApi('/api/slow'));
    expect(seenSignal).toBeDefined();
    expect(seenSignal.aborted).toBe(false);
    unmount();
    expect(seenSignal.aborted).toBe(true);
  });
});
