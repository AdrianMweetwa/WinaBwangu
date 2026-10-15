// Run after npm ci and npm run seed in a fresh checkout.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import net from 'node:net';
const probe = net.createServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
if (!process.env.npm_execpath) throw new Error('Run this check with npm run verify:startup');
const child = spawn(process.execPath, [process.env.npm_execpath, 'start'], {
  env: { ...process.env, PORT: String(port) }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  detached: process.platform !== 'win32',
});
let output = '';
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });
const base = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(output);
    try { ready = (await fetch(base + '/api/health')).ok; } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, `npm start did not become ready: ${output}`);
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'admin', password: 'password123' }),
  });
  assert.equal(login.status, 200);
  const headers = { Cookie: login.headers.get('set-cookie').split(';')[0] };
  for (const route of ['/', '/js/app.js', '/css/style.css', '/api/auth/me', '/api/booths', '/api/services', '/api/users', '/api/transactions', '/api/booths/Wina4/services']) {
    const response = await fetch(base + route, { headers });
    assert.equal(response.status, 200, route);
  }
  const transactions = await (await fetch(base + '/api/transactions', { headers })).json();
  assert.ok(transactions.length >= 308);
  for (const method of ['PUT', 'PATCH', 'DELETE']) {
    assert.equal((await fetch(base + `/api/transactions/${transactions[0].transaction_id}`, { method, headers })).status, 405);
  }
  console.log('Documented npm start verified: authentication, assets, catalog, users, transactions and immutable API.');
} finally {
  if (child.exitCode === null) {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else process.kill(-child.pid, 'SIGTERM');
  }
}
