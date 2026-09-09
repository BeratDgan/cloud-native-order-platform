// Salt okunur HTTP smoke testi; siparis olusturmaz ve cluster ayari degistirmez.
import assert from 'node:assert/strict';

const base = process.argv[2] || 'http://127.0.0.1:18080';
async function request(path) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  return response;
}

const page = await request('/');
assert.match(page.headers.get('content-type') || '', /text\/html/);
console.log('Web UI: HTTP 200');
const readiness = await (await request('/api/readyz')).json();
assert.equal(readiness.storage, 'postgres');
assert.equal(readiness.status, 'ready');
console.log('Backend: ready; storage=postgres');

for (const path of ['/orders', '/api/orders']) {
  const counts = { v1: 0, v2: 0 };
  // Her iki yol icin 100 GET; en fazla bes eszamanli istek.
  for (let batch = 0; batch < 20; batch++) {
    const bodies = await Promise.all(Array.from({ length: 5 }, async () =>
      (await request(path)).json()));
    for (const body of bodies) {
      assert.equal(body.storage, 'postgres');
      assert.ok(Object.hasOwn(counts, body.version), `Unknown version: ${body.version}`);
      counts[body.version]++;
    }
  }
  assert.ok(counts.v1 > 0 && counts.v2 > 0, `${path}: both versions must receive traffic`);
  console.log(`${path}:`, JSON.stringify(counts), '(configured weights 80/20; sample is probabilistic)');
}
console.log('PASS: UI, PostgreSQL readiness, gateway routing and in-mesh routing');
