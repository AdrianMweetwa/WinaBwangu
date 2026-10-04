const express = require("express");

const db = require("../db");
const { hashPassword, verifyPassword } = require("../utils/password");
const { isNonEmptyString, isValidEmail } = require("../utils/validation");
const { requireAuth } = require("../middleware/auth");
const {
  createPasswordResetToken,
  createSession,
  consumePasswordResetToken,
  deleteSession,
  expiredSessionCookie,
  getCookie,
  getUserByIdentifier,
  getUserForSession,
  sessionCookie,
  toPublicUser,
} = require("../auth/session");

const router = express.Router();

router.post("/login", (req, res) => {
  const { identifier, password, remember } = req.body;
  if (!isNonEmptyString(identifier, 120) || typeof password !== "string" || password.length === 0) {
    return res.status(400).json({ error: "Username/email and password are required" });
  }

  const user = getUserByIdentifier(identifier.trim());
  if (!user || user.status !== "active" || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const session = createSession(user.id, Boolean(remember));
  db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);
  res.setHeader("Set-Cookie", sessionCookie(session.token, session.maxAge));
  res.json({ user: toPublicUser({ ...user, last_login: new Date().toISOString() }) });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

router.post("/logout", (req, res) => {
  deleteSession(getCookie(req, "wb_session"));
  res.setHeader("Set-Cookie", expiredSessionCookie());
  res.json({ message: "Logged out successfully" });
});

router.post("/forgot-password", (req, res) => {
  const identifier = String(req.body.identifier || "").trim();
  if (!isNonEmptyString(identifier, 120)) return res.status(400).json({ error: "Username or email is required" });

  const user = getUserByIdentifier(identifier);
  const response = { message: "If an active account matches, password reset instructions have been created." };
  if (user && user.status === "active") {
    const resetToken = createPasswordResetToken(user.id);
    // There is no email provider in this local assignment, so expose a one-time
    // token outside production to keep the reset flow testable end-to-end.
    if (process.env.NODE_ENV !== "production") response.reset_token = resetToken;
  }
  res.json(response);
});

router.post("/reset-password", (req, res) => {
  const { token, password } = req.body;
  if (!isNonEmptyString(token, 200) || typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "A valid reset token and password of at least 8 characters are required" });
  }
  const reset = consumePasswordResetToken(token);
  if (!reset) return res.status(400).json({ error: "This reset token is invalid or expired" });

  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), reset.user_id);
  db.prepare("DELETE FROM auth_sessions WHERE user_id = ?").run(reset.user_id);
  res.json({ message: "Password reset successfully" });
});

module.exports = router;
