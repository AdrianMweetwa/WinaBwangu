const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const { hashPassword, verifyPassword } = require("../backend/utils/password");
const {
  isFiniteNumber,
  isNonEmptyString,
  isPositiveInteger,
  isValidDateString,
  isValidEmail,
  VALID_ROLES,
  VALID_TRANSACTION_TYPES,
} = require("../backend/utils/validation");
const { requireCapability } = require("../backend/middleware/auth");
const { nextTransactionId } = require("../backend/utils/transaction-rules");
const db = require("../backend/db");

test("database compatibility layer converts SQLite statements to PostgreSQL-safe SQL", () => {
  assert.equal(typeof db.prepare, "function");

  const normalized = db.__internal.normalizeSqlForPostgres(
    "INSERT OR IGNORE INTO users (username, email) VALUES (?, ?)",
  );

  assert.match(
    normalized,
    /INSERT INTO users \(username, email\) VALUES \(\$1, \$2\) ON CONFLICT DO NOTHING/i,
  );
  assert.match(
    db.__internal.normalizeSqlForPostgres(
      "DELETE FROM auth_sessions WHERE expires_at <= datetime('now')",
    ),
    /CURRENT_TIMESTAMP/i,
  );
});

test("password hashes verify correctly without exposing the original password", () => {
  const password = "password123";
  const hash = hashPassword(password);

  assert.notEqual(hash, password);
  assert.equal(verifyPassword(password, hash), true);
  assert.equal(verifyPassword("incorrect-password", hash), false);
});

test("transaction IDs are generated from the largest database ID", () => {
  const existing = db
    .prepare("SELECT transaction_id FROM transactions ORDER BY id DESC LIMIT 1")
    .get();
  const nextId = nextTransactionId(db);
  assert.equal(
    nextId,
    `WB${String(Number(existing.transaction_id.replace(/^WB/, "")) + 1).padStart(7, "0")}`,
  );
});

test("startup guarantees the documented demo users are available", () => {
  const { ensureDemoUsers } = require("../backend/db");
  ensureDemoUsers();

  const users = db
    .prepare(
      "SELECT username, status FROM users WHERE username IN ('admin', 'admin_agent', 'agent')",
    )
    .all();
  assert.deepEqual(
    users
      .map(({ username, status }) => ({ username, status }))
      .sort((a, b) => a.username.localeCompare(b.username)),
    [
      { username: "admin", status: "active" },
      { username: "admin_agent", status: "active" },
      { username: "agent", status: "active" },
    ],
  );
});

test("shared validation accepts valid values and rejects invalid values", () => {
  assert.equal(isNonEmptyString("Wina1", 50), true);
  assert.equal(isNonEmptyString("", 50), false);
  assert.equal(isPositiveInteger("6"), true);
  assert.equal(isPositiveInteger("0"), false);
  assert.equal(isFiniteNumber(1.5, { min: 0, max: 2 }), true);
  assert.equal(isFiniteNumber(-1, { min: 0 }), false);
  assert.equal(isValidEmail("agent@example.com"), true);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidDateString("2026-10-04T12:00:00.000Z"), true);
  assert.equal(isValidDateString("not-a-date"), false);
  assert.equal(VALID_ROLES.includes("agent"), true);
  assert.equal(VALID_TRANSACTION_TYPES.includes("withdrawal"), true);
});

test("role capabilities block unauthorized management actions", () => {
  const can = (role, capability) => {
    let allowed = false;
    requireCapability(capability)(
      { user: { role } },
      { status: () => ({ json: () => undefined }) },
      () => {
        allowed = true;
      },
    );
    return allowed;
  };

  assert.equal(can("system_admin", "settings.write"), true);
  assert.equal(can("admin_agent", "settings.view"), true);
  assert.equal(can("admin_agent", "settings.write"), false);
  assert.equal(can("agent", "settings.view"), false);
  assert.equal(can("agent", "transactions.create"), true);
  assert.equal(can("agent", "users.manage"), false);
});

test("global search dropdown stays above the app header", () => {
  const css = fs.readFileSync(
    path.join(__dirname, "../frontend/css/modules/layout.css"),
    "utf8",
  );

  assert.match(css, /\.search\s*\{[^}]*z-index:\s*30;/s);
  assert.match(css, /\.search-results\s*\{[^}]*z-index:\s*40;/s);
});

test("cash services page is restricted to the agent role", () => {
  const authJs = fs.readFileSync(
    path.join(__dirname, "../frontend/js/modules/auth.js"),
    "utf8",
  );

  assert.match(
    authJs,
    /agent:\s*\[\s*"dashboard",\s*"cash-services",\s*"transactions"\s*\]/,
  );
  assert.doesNotMatch(
    authJs,
    /system_admin:\s*\[[^\]]*"cash-services"[^\]]*\]/,
  );
  assert.doesNotMatch(authJs, /admin_agent:\s*\[[^\]]*"cash-services"[^\]]*\]/);
});

test("common service-name typos still match canonical access entries", () => {
  const { hasAssignedAccess } = require("../backend/middleware/auth");
  const user = {
    assigned_booths: "Wina5",
    assigned_services: "Zannaco,FNB",
  };

  assert.equal(hasAssignedAccess(user, "Wina5", "Zanaco"), true);
  assert.equal(hasAssignedAccess(user, "Wina5", "FNB"), true);
  assert.equal(hasAssignedAccess(user, "Wina4", "Zanaco"), false);
});

test("agent assignments include the services available at Wina4", () => {
  const boothServices = db
    .prepare(
      `SELECT s.service
       FROM booth_services bs
       JOIN booths b ON b.id = bs.booth_id
       JOIN services s ON s.id = bs.service_id
       WHERE b.booth = ?
       ORDER BY s.id`,
    )
    .all("Wina4")
    .map(({ service }) => service);

  assert.deepEqual(boothServices, [
    "Airtel Money",
    "MTN Money",
    "Zamtel Money",
    "Zanaco",
    "FNB",
  ]);
});
