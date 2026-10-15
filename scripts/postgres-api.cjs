const assert = require('node:assert/strict');
const app = require('../backend/server');
const db = require('../backend/db');
const server = app.listen(0, '127.0.0.1');
server.once('listening', async () => {
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let cookie;
  async function request(method, route, body) {
    const response = await fetch(base + route, {
      method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  try {
    const login = await request('POST', '/auth/login', { identifier: 'agent', password: 'password123' });
    assert.equal(login.status, 200);
    cookie = login.cookie;
    const payload = { transaction_type: 'deposit', booth_id: 4, service_id: 1, transaction_amount: 1000,
      phone_number: '0971234567', account_number: '', transaction_date: new Date().toISOString() };
    const created = await request('POST', '/transactions', payload);
    assert.equal(created.status, 201);
    assert.deepEqual(created.body.calculation, { tax: 160, amountAfterTax: 840, revenue: 50 });
    assert.equal((await request('GET', '/transactions/WB0000309')).body.transaction_amount, 1000);
    assert.equal((await request('POST', '/transactions', { ...payload, booth_id: 1 })).status, 403);
    assert.equal((await request('POST', '/transactions', { ...payload, transaction_amount: true })).status, 400);
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      assert.equal((await request(method, '/transactions/WB0000309', { ...payload, transaction_amount: 2000 })).status, 405);
    }
    assert.equal((await request('GET', '/transactions/WB0000309')).body.transaction_tax, 160);
    const reset = await request('POST', '/auth/forgot-password', { identifier: 'agent' });
    assert.ok(reset.body.reset_token);
    const resetBody = { token: reset.body.reset_token, password: 'replacement123' };
    assert.equal((await request('POST', '/auth/reset-password', resetBody)).status, 200);
    assert.equal((await request('POST', '/auth/reset-password', resetBody)).status, 400);
    assert.equal((await request('GET', '/auth/me')).status, 401);
    cookie = (await request('POST', '/auth/login', { identifier: 'admin', password: 'password123' })).cookie;
    const agent = db.prepare("SELECT id FROM users WHERE username = 'agent'").get();
    assert.equal((await request('PUT', `/users/${agent.id}`, { assigned_booths: ['Wina1', 'Wina2'] })).status, 400);
    assert.equal((await request('PUT', `/users/${agent.id}`, { assigned_booths: ['Wina2'] })).status, 200);
    assert.equal(db.prepare('SELECT assigned_booths FROM users WHERE id = ?').get(agent.id).assigned_booths, 'Wina2');
    console.log('PostgreSQL API checks passed: login, transactions, access, validation and password reset.');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await db.close();
  }
});
