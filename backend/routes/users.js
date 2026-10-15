const express = require("express");
const db = require("../db");
const { invalidateUserSessions } = require("../auth/session");
const { hashPassword } = require("../utils/password");
const {
  isNonEmptyString,
  isValidEmail,
  VALID_ROLES,
  VALID_STATUSES,
} = require("../utils/validation");

const router = express.Router();

// Keep password hashes out of API responses.
const PUBLIC_COLUMNS = `
  id, username, full_name, email, role, company,
  assigned_booths, assigned_services, status, last_login, created_at
`;

// Convert stored comma-separated assignments to frontend arrays.
function toList(csv) {
  return csv ? csv.split(",").filter(Boolean) : [];
}

function assignmentError(booths, role) {
  if (booths === undefined) return null;
  if (!Array.isArray(booths)) return 'Booth assignments must be an array';
  if (role === 'agent' && booths.length > 1) return 'Assign at most one booth per agent';
  if (booths.some(booth => !isNonEmptyString(booth, 50) || booth.includes(','))) return 'Select a valid booth';
  if (booths.some(booth => !db.prepare('SELECT id FROM booths WHERE booth = ?').get(booth.trim()))) return 'Selected booth does not exist';
  return null;
}

router.get("/", (req, res) => {
  const rows = db
    .prepare(`SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY id`)
    .all();

  const users = rows.map((row) => ({
    ...row,
    assigned_booths: toList(row.assigned_booths),
    assigned_services: toList(row.assigned_services),
  }));

  res.json(users);
});

router.post("/", (req, res) => {
  const error = assignmentError(req.body.assigned_booths, req.body.role);
  if (error) return res.status(400).json({ error });
  const {
    username,
    full_name,
    email,
    password,
    role,
    company,
    assigned_booths,
    assigned_services,
    status,
  } = req.body;

  if (
    !isNonEmptyString(username, 50) ||
    !isNonEmptyString(full_name, 120) ||
    !isValidEmail(email) ||
    typeof password !== "string" ||
    password.length < 8 ||
    !VALID_ROLES.includes(role)
  ) {
    return res.status(400).json({
      error: "Valid username, full name, email, password and role are required",
    });
  }
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const result = db
      .prepare(
        `INSERT INTO users
          (username, full_name, email, password_hash, role, company, assigned_booths, assigned_services, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        username.trim(),
        full_name.trim(),
        email.trim().toLowerCase(),
        hashPassword(password),
        role,
        company || null,
        Array.isArray(assigned_booths) ? assigned_booths.map(value => value.trim()).join(",") : "",
        Array.isArray(assigned_services) ? assigned_services.join(",") : "",
        status === "inactive" ? "inactive" : "active",
      );

    res.status(201).json({
      message: "User created successfully",
      id: result.lastInsertRowid,
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res
        .status(400)
        .json({ error: "Username or email already exists" });
    }
    console.error("User create error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.put("/:id", (req, res) => {
  const existing = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "User not found" });
  }
  const error = assignmentError(
    req.body.assigned_booths === undefined ? toList(existing.assigned_booths) : req.body.assigned_booths,
    req.body.role || existing.role,
  );
  if (error) return res.status(400).json({ error });

  const {
    username,
    full_name,
    email,
    password,
    role,
    company,
    assigned_booths,
    assigned_services,
    status,
  } = req.body;

  if (username !== undefined && !isNonEmptyString(username, 50)) {
    return res.status(400).json({ error: "Invalid username" });
  }
  if (full_name !== undefined && !isNonEmptyString(full_name, 120)) {
    return res.status(400).json({ error: "Invalid full name" });
  }
  if (email !== undefined && !isValidEmail(email)) {
    return res.status(400).json({ error: "Invalid email" });
  }
  if (
    password !== undefined &&
    (typeof password !== "string" || password.length < 8)
  ) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters" });
  }
  if (role !== undefined && !VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    db.prepare(
      `UPDATE users SET
        username = ?, full_name = ?, email = ?, password_hash = ?,
        role = ?, company = ?, assigned_booths = ?, assigned_services = ?, status = ?
       WHERE id = ?`,
    ).run(
      username !== undefined ? username.trim() : existing.username,
      full_name !== undefined ? full_name.trim() : existing.full_name,
      email !== undefined ? email.trim().toLowerCase() : existing.email,
      password ? hashPassword(password) : existing.password_hash,
      role || existing.role,
      company !== undefined ? company : existing.company,
      Array.isArray(assigned_booths)
        ? assigned_booths.map(value => value.trim()).join(",")
        : existing.assigned_booths,
      Array.isArray(assigned_services)
        ? assigned_services.join(",")
        : existing.assigned_services,
      status || existing.status,
      req.params.id,
    );

    const accessSensitiveFields = [
      "role",
      "assigned_booths",
      "assigned_services",
      "status",
      "password",
    ];
    const shouldInvalidateSessions = accessSensitiveFields.some((field) =>
      Object.prototype.hasOwnProperty.call(req.body, field),
    );

    if (shouldInvalidateSessions) {
      invalidateUserSessions(req.params.id);
    }

    res.json({ message: "User updated successfully" });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res
        .status(400)
        .json({ error: "Username or email already exists" });
    }
    console.error("User update error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", (req, res) => {
  const result = db
    .prepare("DELETE FROM users WHERE id = ?")
    .run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: "User not found" });
  }
  invalidateUserSessions(req.params.id);
  res.json({ message: "User deleted successfully" });
});

module.exports = router;
