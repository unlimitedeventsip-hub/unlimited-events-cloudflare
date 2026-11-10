// Cloudflare Worker entry: static assets + secure form API.
// Reuses the same validated handlers as the Pages Functions implementation.
import { onRequestPost } from '../functions/api/lead.js';
import { onRequestGet } from '../functions/api/config.js';

const API_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const error = (message, status) => new Response(JSON.stringify({ ok: false, message }), { status, headers: API_HEADERS });

export default {
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/api/config') {
      if (request.method !== 'GET') return error('Metodă neacceptată.', 405);
      return onRequestGet({ request, env, ctx });
    }
    if (pathname === '/api/lead') {
      if (request.method !== 'POST') return error('Metodă neacceptată.', 405);
      return onRequestPost({ request, env, ctx });
    }
    if (pathname.startsWith('/api/')) return error('Ruta API nu există.', 404);
    // Normally the edge serves assets without running this Worker.
    return env.ASSETS.fetch(request);
  },
};
