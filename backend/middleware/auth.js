const { getCookie, getUserForSession } = require("../auth/session");

const roleCapabilities = {
  system_admin: [
    "catalog.view",
    "settings.view",
    "settings.write",
    "transactions.view",
    "transactions.create",
    "users.manage",
  ],
  admin_agent: ["catalog.view", "settings.view", "transactions.view", "transactions.create"],
  agent: ["catalog.view", "transactions.view", "transactions.create"],
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
      return res.status(403).json({ error: "You do not have permission to perform this action" });
    }
    next();
  };
}

function requireCapability(capability) {
  return (req, res, next) => {
    const capabilities = roleCapabilities[req.user?.role] || [];
    if (!capabilities.includes(capability)) {
      return res.status(403).json({ error: "You do not have permission to perform this action" });
    }
    next();
  };
}

function isSystemAdmin(user) {
  return user?.role === "system_admin";
}

function hasAssignedAccess(user, boothCode, serviceName) {
  if (isSystemAdmin(user)) return true;
  const booths = String(user.assigned_booths || "").split(",").filter(Boolean);
  const services = String(user.assigned_services || "").split(",").filter(Boolean);
  return booths.includes(boothCode) && services.includes(serviceName);
}

module.exports = { hasAssignedAccess, isSystemAdmin, requireAuth, requireCapability, requireRole };
