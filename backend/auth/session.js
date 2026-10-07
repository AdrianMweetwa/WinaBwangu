const { createHash, randomBytes } = require("crypto");

const db = require("../db");

const SESSION_COOKIE = "wb_session";
const SESSION_HOURS = 8;
const REMEMBERED_SESSION_DAYS = 30;
const RESET_TOKEN_MINUTES = 30;

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function parseList(value) {
  return value
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    company: row.company,
    assigned_booths: Array.isArray(row.assigned_booths)
      ? row.assigned_booths
      : parseList(row.assigned_booths),
    assigned_services: Array.isArray(row.assigned_services)
      ? row.assigned_services
      : parseList(row.assigned_services),
    status: row.status,
    last_login: row.last_login,
    created_at: row.created_at,
  };
}

function getUserByIdentifier(identifier) {
  return db
    .prepare(
      "SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?) LIMIT 1",
    )
    .get(identifier, identifier);
}

function getUserById(userId) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
}

function createSession(userId, remember = false) {
  const token = randomBytes(32).toString("base64url");
  const hours = remember ? REMEMBERED_SESSION_DAYS * 24 : SESSION_HOURS;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  db.prepare(
    "INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
  ).run(userId, hashToken(token), expiresAt);
  return { token, maxAge: hours * 60 * 60 };
}

function getUserForSession(token) {
  if (!token) return null;
  db.prepare(
    "DELETE FROM auth_sessions WHERE expires_at <= datetime('now')",
  ).run();
  const session = db
    .prepare(
      "SELECT user_id FROM auth_sessions WHERE token_hash = ? AND expires_at > ?",
    )
    .get(hashToken(token), new Date().toISOString());
  if (!session) return null;
  const user = getUserById(session.user_id);
  return user && user.status === "active" ? user : null;
}

function deleteSession(token) {
  if (token)
    db.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(
      hashToken(token),
    );
}

function invalidateUserSessions(userId) {
  if (!userId) return 0;
  const result = db
    .prepare("DELETE FROM auth_sessions WHERE user_id = ?")
    .run(userId);
  return result.changes || 0;
}

function createPasswordResetToken(userId) {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(
    Date.now() + RESET_TOKEN_MINUTES * 60 * 1000,
  ).toISOString();
  db.prepare(
    "DELETE FROM password_reset_tokens WHERE user_id = ? OR expires_at <= datetime('now')",
  ).run(userId);
  db.prepare(
    "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
  ).run(userId, hashToken(token), expiresAt);
  return token;
}

function consumePasswordResetToken(token) {
  const reset = db
    .prepare(
      "SELECT * FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?",
    )
    .get(hashToken(token), new Date().toISOString());
  if (!reset) return null;
  db.prepare(
    "UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?",
  ).run(reset.id);
  return reset;
}

function sessionCookie(token, maxAge) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

function expiredSessionCookie() {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`;
}

function getCookie(req, name) {
  const cookies = String(req.headers.cookie || "").split(";");
  const entry = cookies.find((cookie) => cookie.trim().startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.trim().slice(name.length + 1)) : null;
}

module.exports = {
  SESSION_COOKIE,
  createPasswordResetToken,
  createSession,
  consumePasswordResetToken,
  deleteSession,
  expiredSessionCookie,
  getCookie,
  getUserByIdentifier,
  getUserForSession,
  hashToken,
  invalidateUserSessions,
  sessionCookie,
  toPublicUser,
};
