// Krelz Network — Cloudflare Worker reverse proxy.
//
// Purpose: visitors whose network filters the krelz.xyz TLS SNI (e.g. Iran,
// ERR_CONNECTION_CLOSED) still get the full site over TLS at
//     https://krelz.<account>.workers.dev
// The browser talks to workers.dev (allowed); the Worker fetches
// https://krelz.xyz server-side (Cloudflare → Cloudflare, never touches the
// filtered path). All frontend URLs are relative (/api, /_next), so no rewrite
// of the body is needed — only `Location` headers that point back at the apex.
//
// Deploy (needs a Cloudflare API token with Workers Scripts:Edit):
//   CLOUDFLARE_API_TOKEN=... npx wrangler deploy -c deploy/wrangler.toml

const UPSTREAM = 'https://krelz.xyz';

// Hop-by-hop headers must not be forwarded by a proxy (RFC 7230 §6.1).
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function upstreamRequest(request) {
  const url = new URL(request.url);
  const upstreamUrl = new URL(UPSTREAM);
  upstreamUrl.pathname = url.pathname;
  upstreamUrl.search = url.search;

  const headers = new Headers(request.headers);
  for (const h of HOP_BY_HOP) headers.delete(h);
  headers.set('X-Forwarded-Proto', 'https');

  const init = { method: request.method, headers, redirect: 'manual' };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body;
    init.duplex = 'half';
  }
  return new Request(upstreamUrl, init);
}

// Redirects (30x) that carry an absolute krelz.xyz Location would dump the
// visitor back onto the filtered origin — re-point them at this Worker.
function fixLocation(response, workerOrigin) {
  const loc = response.headers.get('Location');
  if (!loc) return response;
  const rewritten = loc.replace(/^https?:\/\/(www\.)?krelz\.xyz(?=[:/]|$)/, workerOrigin);
  if (rewritten === loc) return response;
  const headers = new Headers(response.headers);
  headers.set('Location', rewritten);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env, ctx) {
    const workerOrigin = new URL(request.url).origin;

    // WebSocket passthrough (miner/chat realtime if a browser ever opens it):
    // `fetch` with an Upgrade header proxies the socket bidirectionally.
    if ((request.headers.get('Upgrade') || '').toLowerCase() === 'websocket') {
      return fetch(upstreamRequest(request));
    }

    const response = await fetch(upstreamRequest(request));
    return fixLocation(response, workerOrigin);
  },
};
