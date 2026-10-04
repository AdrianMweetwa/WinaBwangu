const VALID_ROLES = ["system_admin", "admin_agent", "agent"];
const VALID_STATUSES = ["active", "inactive"];
const VALID_TRANSACTION_TYPES = ["deposit", "withdrawal"];
const VALID_IDENTIFIER_TYPES = ["phone", "account"];

function isNonEmptyString(value, maxLength = 255) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isPositiveInteger(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

function isFiniteNumber(value, { min = -Infinity, max = Infinity } = {}) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidDateString(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

module.exports = {
  VALID_ROLES,
  VALID_STATUSES,
  VALID_TRANSACTION_TYPES,
  VALID_IDENTIFIER_TYPES,
  isNonEmptyString,
  isPositiveInteger,
  isFiniteNumber,
  isValidEmail,
  isValidDateString,
};
