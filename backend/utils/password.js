// Password hashing using Node's built-in crypto module (scrypt).
// No extra dependency needed since scrypt ships with Node itself.
const { scryptSync, randomBytes, timingSafeEqual } = require("crypto");

// Hash a plain-text password into "salt:hash" (both hex-encoded).
// A fresh random salt is generated per password so two identical
// passwords never produce the same stored value.
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// Check a plain-text password against a "salt:hash" value produced above.
function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const candidateBuffer = scryptSync(password, salt, 64);
  // timingSafeEqual requires equal-length buffers, and also guards
  // against leaking password length through comparison timing.
  if (hashBuffer.length !== candidateBuffer.length) return false;
  return timingSafeEqual(hashBuffer, candidateBuffer);
}

module.exports = { hashPassword, verifyPassword };
