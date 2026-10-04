const express = require("express");
const db = require("../db");
const { hashPassword } = require("../utils/password");

const router = express.Router();

// Columns safe to send to the browser (never send password_hash back).
const PUBLIC_COLUMNS = `
  id, username, full_name, email, role, company,
  assigned_booths, assigned_services, status, last_login, created_at
`;

// Turn "" into [] and "Wina1,Wina2" into ["Wina1", "Wina2"] for the frontend.
function toList(csv) {
  return csv ? csv.split(",").filter(Boolean) : [];
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

  if (!username || !full_name || !email || !password || !role) {
    return res.status(400).json({
      error: "username, full_name, email, password and role are required",
    });
  }

  const validRoles = ["system_admin", "admin_agent", "agent"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }

  try {
    const result = db
      .prepare(
        `INSERT INTO users
          (username, full_name, email, password_hash, role, company, assigned_booths, assigned_services, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        username,
        full_name,
        email,
        hashPassword(password),
        role,
        company || null,
        Array.isArray(assigned_booths) ? assigned_booths.join(",") : "",
        Array.isArray(assigned_services) ? assigned_services.join(",") : "",
        status === "inactive" ? "inactive" : "active",
      );

    res.status(201).json({ message: "User created successfully", id: result.lastInsertRowid });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(400).json({ error: "Username or email already exists" });
    }
    console.error("User create error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.put("/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "User not found" });
  }

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

  try {
    db.prepare(
      `UPDATE users SET
        username = ?, full_name = ?, email = ?, password_hash = ?,
        role = ?, company = ?, assigned_booths = ?, assigned_services = ?, status = ?
       WHERE id = ?`,
    ).run(
      username || existing.username,
      full_name || existing.full_name,
      email || existing.email,
      password ? hashPassword(password) : existing.password_hash,
      role || existing.role,
      company !== undefined ? company : existing.company,
      Array.isArray(assigned_booths) ? assigned_booths.join(",") : existing.assigned_booths,
      Array.isArray(assigned_services) ? assigned_services.join(",") : existing.assigned_services,
      status || existing.status,
      req.params.id,
    );

    res.json({ message: "User updated successfully" });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(400).json({ error: "Username or email already exists" });
    }
    console.error("User update error:", error);
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:id", (req, res) => {
  const result = db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json({ message: "User deleted successfully" });
});

module.exports = router;
