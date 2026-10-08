const { getCookie, getUserForSession } = require("../auth/session");

const roleCapabilities = {
  system_admin: [
    "catalog.view",
    "settings.view",
    "settings.write",
    "transactions.view",
    "transactions.create",
    "transactions.update",
    "transactions.delete",
    "users.manage",
  ],
  admin_agent: [
    "catalog.view",
    "settings.view",
    "transactions.view",
    "transactions.create",
    "transactions.update",
    "transactions.delete",
  ],
  agent: [
    "catalog.view",
    "transactions.view",
    "transactions.create",
    "transactions.update",
    "transactions.delete",
  ],
};

function requireAuth(req, res, next) {
  const user = getUserForSession(getCookie(req, "wb_session"));
  if (!user) return res.status(401).json({ error: "Authentication required" });
  req.user = user;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: "You do not have permission to perform this action" });
    }
    next();
  };
}

function requireCapability(capability) {
  return (req, res, next) => {
    const capabilities = roleCapabilities[req.user?.role] || [];
    if (!capabilities.includes(capability)) {
      return res
        .status(403)
        .json({ error: "You do not have permission to perform this action" });
    }
    next();
  };
}

function isSystemAdmin(user) {
  return user?.role === "system_admin";
}

function normalizeAccessValue(value) {
  if (value == null) return "";
  const text = String(value).trim();
  const canonical = text
    .replace(/\s+/g, " ")
    .replace(/\bZannaco\b/gi, "Zanaco")
    .replace(/\bZanaco\b/gi, "Zanaco");
  return canonical;
}

function hasAssignedAccess(user, boothCode, serviceName) {
  if (isSystemAdmin(user)) return true;
  const booths = String(user.assigned_booths || "")
    .split(",")
    .map((value) => normalizeAccessValue(value))
    .filter(Boolean);
  const services = String(user.assigned_services || "")
    .split(",")
    .map((value) => normalizeAccessValue(value))
    .filter(Boolean);
  const normalizedBooth = normalizeAccessValue(boothCode);
  const normalizedService = normalizeAccessValue(serviceName);
  return (
    booths.includes(normalizedBooth) && services.includes(normalizedService)
  );
}

module.exports = {
  hasAssignedAccess,
  isSystemAdmin,
  requireAuth,
  requireCapability,
  requireRole,
};
