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

test("password hashes verify correctly without exposing the original password", () => {
  const password = "password123";
  const hash = hashPassword(password);

  assert.notEqual(hash, password);
  assert.equal(verifyPassword(password, hash), true);
  assert.equal(verifyPassword("incorrect-password", hash), false);
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
      () => { allowed = true; },
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
  const css = fs.readFileSync(path.join(__dirname, "../frontend/css/modules/layout.css"), "utf8");

  assert.match(css, /\.search\s*\{[^}]*z-index:\s*30;/s);
  assert.match(css, /\.search-results\s*\{[^}]*z-index:\s*40;/s);
});

test("cash services page is restricted to the agent role", () => {
  const authJs = fs.readFileSync(path.join(__dirname, "../frontend/js/modules/auth.js"), "utf8");

  assert.match(authJs, /agent:\s*\[\s*"dashboard",\s*"cash-services",\s*"transactions"\s*\]/);
  assert.doesNotMatch(authJs, /system_admin:\s*\[[^\]]*"cash-services"[^\]]*\]/);
  assert.doesNotMatch(authJs, /admin_agent:\s*\[[^\]]*"cash-services"[^\]]*\]/);
});
