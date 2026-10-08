// Password hashing using Node's built-in scrypt implementation.
const { scryptSync, randomBytes, timingSafeEqual } = require("crypto");

// Store the salt with the hash so it can be checked during login.
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const candidateBuffer = scryptSync(password, salt, 64);
  // timingSafeEqual only accepts buffers with the same length.
  if (hashBuffer.length !== candidateBuffer.length) return false;
  return timingSafeEqual(hashBuffer, candidateBuffer);
}

module.exports = { hashPassword, verifyPassword };
