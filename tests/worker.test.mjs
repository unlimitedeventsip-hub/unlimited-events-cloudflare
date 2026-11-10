import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const url = 'https://unlimited-events-cloudflare.example.workers.dev';
const form = {
  eventType: 'birthday', description: 'Organizăm o aniversare cu 80 de invitați.',
  city: 'București', date: null, guests: '30–100', budget: null,
  extras: ['Catering / bar'], fullName: 'Client Exemplu',
  email: 'test@example.com', phone: '+40 722 123 456',
  consent: true, website: '', sourcePath: '/',
};

test('Workers runtime serves config without leaking secret keys', async () => {
  const response = await worker.fetch(new Request(url + '/api/config'), {
    TURNSTILE_SITE_KEY: 'site-public', SUPABASE_SECRET_KEY: 'must-not-leak',
  }, {});
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data, {turnstileSiteKey: 'site-public'});
});

test('Workers runtime rejects unsupported API methods and paths', async () => {
  const post = await worker.fetch(new Request(url + '/api/config', {method: 'POST'}), {}, {});
  assert.equal(post.status, 405);
  const get = await worker.fetch(new Request(url + '/api/lead'), {}, {});
  assert.equal(get.status, 405);
  const missing = await worker.fetch(new Request(url + '/api/unknown'), {}, {});
  assert.equal(missing.status, 404);
});

test('Workers runtime reports missing production bindings', async () => {
  const request = new Request(url + '/api/lead', {
    method: 'POST', headers: {'content-type': 'application/json', 'origin': url}, body: JSON.stringify(form),
  });
  const response = await worker.fetch(request, {}, {});
  assert.equal(response.status, 503);
});

test('Workers runtime persists lead with a server-side secret key', async () => {
  const calls = [];
  globalThis.fetch = async (uri, opts) => {
    calls.push({uri: String(uri), opts});
    if (opts.method === 'POST') return Response.json([{id: '4c855a23-7e53-4f1d-8586-21e8bc212c9e'}], {status: 201});
    if (opts.method === 'PATCH') return new Response(null, {status: 204});
    throw new Error('Unexpected upstream request');
  };
  const request = new Request(url + '/api/lead', {
    method: 'POST', headers: {'content-type': 'application/json', origin: url}, body: JSON.stringify(form),
  });
  const response = await worker.fetch(request, {
    SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test',
    EMAIL_TO: 'unlimited.events.ip@gmail.com',
  }, {});
  assert.equal(response.status, 201);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.emailSent, false);
  assert.equal(calls[0].opts.headers.apikey, 'sb_secret_test');
  assert.ok(calls[0].uri.endsWith('/rest/v1/event_leads?select=id'));
});

test('Worker returns its static asset binding for non-API requests', async () => {
  const asset = new Response('<html>Unlimited Events</html>', {status: 200});
  const reply = await worker.fetch(new Request(url + '/'), {
    ASSETS: {fetch: async () => asset},
  }, {});
  assert.equal(reply.status, 200);
  assert.match(await reply.text(), /Unlimited Events/);
});
