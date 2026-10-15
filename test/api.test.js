process.env.NODE_ENV = "test";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "winabwangu-api-"));
process.env.DATABASE_PATH = path.join(directory, "test.db");
delete process.env.DATABASE_URL;
process.env.NODE_ENV = "test";
let db, server, base;
test.after(async () => {
  if (server) await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
  if (db) db.close();
  fs.rmSync(directory, { recursive: true, force: true });
});
execFileSync(process.execPath, [path.join(__dirname, "../database/seed.js")], {
  env: process.env, stdio: "pipe",
});
db = require("../backend/db");
const app = require("../backend/server");
test.before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
// Each case rolls back its writes, including passwords, sessions and transactions.
test.beforeEach(() => db.exec("SAVEPOINT api_case"));
test.afterEach(() => db.exec("ROLLBACK TO api_case; RELEASE api_case"));

async function request(method, route, body, cookie) {
  const response = await fetch(base + route, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    body: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
async function login(identifier = "admin", password = "password123") {
  const response = await request("POST", "/auth/login", { identifier, password });
  assert.equal(response.status, 200);
  assert.ok(response.cookie);
  assert.equal(response.body.user.password_hash, undefined);
  return response.cookie;
}
const payload = {
  transaction_type: "deposit", booth_id: 4, service_id: 1,
  transaction_amount: 1000, phone_number: "0971234567", account_number: "",
  transaction_date: "2026-10-04T12:00:00.000Z",
};
const record = (id) => db.prepare("SELECT * FROM transactions WHERE transaction_id = ?").get(id);

test("transaction API creates and reads records but rejects all modifications", async () => {
  const cookie = await login("agent");
  const created = await request("POST", "/transactions", {
    ...payload, transaction_id: "WB9999999", transaction_tax: 0, transaction_revenue: 999,
  }, cookie);
  assert.equal(created.status, 201);
  assert.deepEqual(created.body.calculation, { tax: 160, amountAfterTax: 840, revenue: 50 });
  const row = record("WB0000309");
  assert.equal(row.id, created.body.id);
  assert.equal(row.transaction_amount, 1000);
  assert.equal(row.transaction_tax, 160);
  assert.equal(row.transaction_amount_after_tax, 840);
  assert.equal(row.transaction_revenue, 50);
  const read = await request("GET", "/transactions/WB0000309", undefined, cookie);
  assert.equal(read.status, 200);
  assert.equal(read.body.transaction_id, "WB0000309");
  for (const role of ["agent", "admin_agent", "admin"]) {
    const auth = await login(role);
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      assert.equal((await request(method, "/transactions/WB0000309", payload, auth)).status, 405);
      assert.deepEqual(record("WB0000309"), row);
    }
  }
});

test("agents cannot access transactions outside assigned booths or services", async () => {
  // Restrict services as well as booths to exercise both access boundaries.
  db.prepare("UPDATE users SET assigned_services = 'Airtel Money' WHERE username = 'agent'").run();
  const cookie = await login("agent");
  const list = await request("GET", "/transactions", undefined, cookie);
  assert.equal(list.status, 200);
  assert.ok(list.body.length > 0);
  assert.ok(list.body.every((row) => row.booth === "Wina4" && row.service === "Airtel Money"));
  const denied = [
    db.prepare("SELECT * FROM transactions WHERE booth_id != 4 LIMIT 1").get(),
    db.prepare("SELECT * FROM transactions WHERE booth_id = 4 AND service_id != 1 LIMIT 1").get(),
  ];
  for (const row of denied) {
    for (const method of ["GET"]) {
      assert.equal((await request(method, `/transactions/${row.transaction_id}`, method === "PUT" ? payload : undefined, cookie)).status, 403);
      assert.deepEqual(record(row.transaction_id), row);
    }
  }
  for (const changes of [{ booth_id: 1 }, { service_id: 2 }]) {
    assert.equal((await request("POST", "/transactions", { ...payload, ...changes }, cookie)).status, 403);
    const allowed = list.body[0];
    const before = record(allowed.transaction_id);
    assert.equal((await request("PUT", `/transactions/${allowed.transaction_id}`, { ...payload, ...changes }, cookie)).status, 405);
    assert.deepEqual(record(allowed.transaction_id), before);
  }
});

test("creation rejects invalid transaction data without changing records", async () => {
  const cookie = await login();
  const before = db.prepare("SELECT * FROM transactions ORDER BY id").all();
  const invalid = [
    { transaction_amount: 0 }, { transaction_amount: -1 },
    { transaction_amount: null }, { transaction_amount: true },
    { transaction_amount: " " }, { transaction_amount: "Infinity" },
    { transaction_amount: "NaN" }, { transaction_date: "not-a-date" },
    { transaction_type: "invalid" }, { booth_id: 9999 }, { service_id: 9999 },
    { booth_id: null }, { service_id: null }, { booth_id: true },
    { service_id: 4 }, // Zanaco is unavailable at Wina4.
  ];
  for (const change of invalid) {
    for (const method of ["POST"]) {
      const route = method === "POST" ? "/transactions" : "/transactions/WB0000001";
      assert.equal((await request(method, route, { ...payload, ...change }, cookie)).status, 400, `${method} ${JSON.stringify(change)}`);
    }
  }
  assert.deepEqual(db.prepare("SELECT * FROM transactions ORDER BY id").all(), before);
});

test("authentication rejects incorrect credentials and inactive accounts", async () => {
  for (const identifier of ["admin", "unknown-user"]) {
    assert.equal((await request("POST", "/auth/login", { identifier, password: "wrong" })).status, 401);
  }
  const cookie = await login("agent");
  db.prepare("UPDATE users SET status = 'inactive' WHERE username = 'agent'").run();
  assert.equal((await request("POST", "/auth/login", { identifier: "agent", password: "password123" })).status, 401);
  assert.equal((await request("GET", "/auth/me", undefined, cookie)).status, 401);
});

test("protected routes reject missing and expired sessions and logout revokes access", async () => {
  for (const route of ["/auth/me", "/transactions"]) {
    assert.equal((await request("GET", route)).status, 401);
  }
  const expired = await login();
  db.prepare("UPDATE auth_sessions SET expires_at = ?").run(new Date(Date.now() - 1000).toISOString());
  assert.equal((await request("GET", "/transactions", undefined, expired)).status, 401);
  const cookie = await login();
  assert.equal((await request("GET", "/auth/me", undefined, cookie)).status, 200);
  assert.equal((await request("POST", "/auth/logout", {}, cookie)).status, 200);
  assert.equal((await request("GET", "/transactions", undefined, cookie)).status, 401);
});

async function resetToken() {
  const response = await request("POST", "/auth/forgot-password", { identifier: "agent" });
  assert.equal(response.status, 200);
  assert.ok(response.body.reset_token);
  return response.body.reset_token;
}
test("password reset rejects expired tokens without changing the password", async () => {
  const token = await resetToken();
  db.prepare("UPDATE password_reset_tokens SET expires_at = ?").run(new Date(Date.now() - 1000).toISOString());
  assert.equal((await request("POST", "/auth/reset-password", { token, password: "new-password123" })).status, 400);
  await login("agent");
});

test("password reset is single-use, changes credentials and revokes all user sessions", async () => {
  const cookies = [await login("agent"), await login("agent")];
  const adminCookie = await login();
  const token = await resetToken();
  const body = { token, password: "new-password123" };
  assert.equal((await request("POST", "/auth/reset-password", body)).status, 200);
  assert.equal((await request("POST", "/auth/reset-password", body)).status, 400);
  for (const cookie of cookies) {
    assert.equal((await request("GET", "/auth/me", undefined, cookie)).status, 401);
  }
  assert.equal((await request("GET", "/auth/me", undefined, adminCookie)).status, 200);
  assert.equal((await request("POST", "/auth/login", { identifier: "agent", password: "password123" })).status, 401);
  await login("agent", body.password);
});


test("user API enforces a single booth on creation and reassignment", async () => {
  const cookie = await login();
  const user = { username: "newagent", full_name: "New Agent", email: "new@example.com", password: "password123", role: "agent", assigned_services: ["Airtel Money"] };
  for (const booths of [["Wina1", "Wina2"], "Wina1,Wina2", ["missing"], ["Wina1,Wina2"], [null]]) {
    assert.equal((await request("POST", "/users", { ...user, assigned_booths: booths }, cookie)).status, 400);
  }
  const created = await request("POST", "/users", { ...user, assigned_booths: ["Wina1"] }, cookie);
  assert.equal(created.status, 201);
  const route = `/users/${created.body.id}`;
  assert.equal((await request("PUT", route, { assigned_booths: ["Wina2", "Wina3"] }, cookie)).status, 400);
  assert.equal(db.prepare("SELECT assigned_booths FROM users WHERE id = ?").get(created.body.id).assigned_booths, "Wina1");
  assert.equal((await request("PUT", route, { assigned_booths: ["Wina2"] }, cookie)).status, 200);
  const users = await request("GET", "/users", undefined, cookie);
  assert.deepEqual(users.body.find(user => user.id === created.body.id).assigned_booths, ["Wina2"]);
});

test("database rejects transaction updates, deletion, replacement and cascading deletion", () => {
  const before = record("WB0000001");
  for (const sql of [
    "UPDATE transactions SET transaction_amount = 1 WHERE transaction_id = 'WB0000001'",
    "DELETE FROM transactions WHERE transaction_id = 'WB0000001'",
    `DELETE FROM booths WHERE id = ${before.booth_id}`,
    `DELETE FROM services WHERE id = ${before.service_id}`,
    "INSERT OR REPLACE INTO transactions SELECT * FROM transactions WHERE transaction_id = 'WB0000001'",
  ]) assert.throws(() => db.exec(sql), /transactions|FOREIGN KEY/i);
  assert.deepEqual(record("WB0000001"), before);
  assert.throws(() => db.prepare("UPDATE users SET assigned_booths = ? WHERE username = 'agent'").run("Wina1,Wina2"), /one booth/i);
});

test("admin agents support multiple booths, regular agents cannot inherit them, and admins see everything", async () => {
  const cookie = await login();
  const user = db.prepare("SELECT id FROM users WHERE username = 'admin_agent'").get();
  assert.equal((await request('PUT', `/users/${user.id}`, { assigned_booths: ['Wina1', 'Wina2'] }, cookie)).status, 200);
  const adminAgentCookie = await login('admin_agent');
  const booths = await request('GET', '/booths', undefined, adminAgentCookie);
  assert.deepEqual(booths.body.map(booth => booth.booth), ['Wina1', 'Wina2']);
  assert.equal((await request('PUT', `/users/${user.id}`, { role: 'agent' }, cookie)).status, 400);
  assert.throws(() => db.prepare("UPDATE users SET role = 'agent' WHERE id = ?").run(user.id), /one booth/i);
  assert.equal((await request('PUT', `/users/${user.id}`, { role: 'agent', assigned_booths: ['Wina2'] }, cookie)).status, 200);
  for (const [route, count] of [['/booths', 6], ['/services', 5], ['/transactions', 308]]) {
    const result = await request('GET', route, undefined, cookie);
    assert.equal(result.status, 200);
    assert.equal(result.body.length, count);
  }
});
