const express = require("express");

const db = require("../db");
const { isNonEmptyString, isPositiveInteger } = require("../utils/validation");
const { isSystemAdmin, requireCapability } = require("../middleware/auth");
const router = express.Router();

router.get("/", requireCapability("catalog.view"), (req, res) => {
  let booths = db.prepare("SELECT * FROM booths ORDER BY id").all();
  if (!isSystemAdmin(req.user)) {
    const allowed = String(req.user.assigned_booths || "")
      .split(",")
      .map((value) => String(value).trim())
      .map((value) => value.replace(/\bZannaco\b/gi, "Zanaco"))
      .filter(Boolean);
    booths = booths.filter((booth) => allowed.includes(booth.booth));
  }
  res.json(booths);
});

router.get(
  "/:booth/services",
  requireCapability("catalog.view"),
  (req, res) => {
    const booth = db
      .prepare("SELECT * FROM booths WHERE booth = ?")
      .get(req.params.booth);
    if (!booth) {
      return res.status(404).json({ error: "Booth not found" });
    }
    if (!isSystemAdmin(req.user)) {
      const allowed = String(req.user.assigned_booths || "")
        .split(",")
        .map((value) => String(value).trim())
        .map((value) => value.replace(/\bZannaco\b/gi, "Zanaco"))
        .filter(Boolean);
      if (!allowed.includes(booth.booth)) {
        return res
          .status(403)
          .json({ error: "You do not have access to this booth" });
      }
    }

    let services = db
      .prepare(
        `
        SELECT * FROM services
        JOIN booth_services ON services.id = booth_services.service_id
        WHERE booth_services.booth_id = ? ORDER BY services.id
    `,
      )
      .all(booth.id);
    if (!isSystemAdmin(req.user)) {
      const allowed = String(req.user.assigned_services || "")
        .split(",")
        .map((value) => String(value).trim())
        .map((value) => value.replace(/\bZannaco\b/gi, "Zanaco"))
        .filter(Boolean);
      services = services.filter((service) =>
        allowed.includes(service.service),
      );
    }

    res.json({ booth, services });
  },
);

// Create a booth and link its available services.
router.post("/", requireCapability("settings.write"), (req, res) => {
  const { booth, location, services } = req.body;

  if (!isNonEmptyString(booth, 50) || !isNonEmptyString(location, 120)) {
    return res
      .status(400)
      .json({
        error: "booth and location are required and must be valid text",
      });
  }
  if (services !== undefined && !Array.isArray(services)) {
    return res.status(400).json({ error: "services must be an array" });
  }

  try {
    const result = db
      .prepare("INSERT INTO booths (booth, location) VALUES (?, ?)")
      .run(booth.trim(), location.trim());

    const findService = db.prepare("SELECT id FROM services WHERE service = ?");
    const linkService = db.prepare(
      "INSERT OR IGNORE INTO booth_services (booth_id, service_id) VALUES (?, ?)",
    );
    for (const serviceName of services || []) {
      const service = findService.get(String(serviceName).trim());
      if (service) linkService.run(result.lastInsertRowid, service.id);
    }

    res
      .status(201)
      .json({
        message: "Booth created successfully",
        id: result.lastInsertRowid,
      });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res
        .status(400)
        .json({ error: "A booth with this code already exists" });
    }
    console.error("Booth create error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update a booth and replace its service assignments.
router.put("/:id", requireCapability("settings.write"), (req, res) => {
  const { booth, location, services } = req.body;
  if (!isPositiveInteger(req.params.id)) {
    return res.status(400).json({ error: "A valid booth id is required" });
  }
  if (!isNonEmptyString(booth, 50) || !isNonEmptyString(location, 120)) {
    return res
      .status(400)
      .json({
        error: "booth and location are required and must be valid text",
      });
  }
  if (services !== undefined && !Array.isArray(services)) {
    return res.status(400).json({ error: "services must be an array" });
  }

  const existing = db
    .prepare("SELECT id FROM booths WHERE id = ?")
    .get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Booth not found" });

  try {
    const updateBooth = db.prepare(
      "UPDATE booths SET booth = ?, location = ? WHERE id = ?",
    );
    const clearServices = db.prepare(
      "DELETE FROM booth_services WHERE booth_id = ?",
    );
    const findService = db.prepare("SELECT id FROM services WHERE service = ?");
    const linkService = db.prepare(
      "INSERT OR IGNORE INTO booth_services (booth_id, service_id) VALUES (?, ?)",
    );

    db.transaction(() => {
      updateBooth.run(booth.trim(), location.trim(), req.params.id);
      clearServices.run(req.params.id);
      for (const serviceName of services || []) {
        const service = findService.get(String(serviceName).trim());
        if (service) linkService.run(req.params.id, service.id);
      }
    })();

    res.json({ message: "Booth updated successfully" });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res
        .status(400)
        .json({ error: "A booth with this code already exists" });
    }
    console.error("Booth update error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Keep booth history safe by blocking deletion when transactions exist.
router.delete("/:id", requireCapability("settings.write"), (req, res) => {
  if (!isPositiveInteger(req.params.id)) {
    return res.status(400).json({ error: "A valid booth id is required" });
  }
  const hasTransactions = db
    .prepare("SELECT 1 FROM transactions WHERE booth_id = ? LIMIT 1")
    .get(req.params.id);
  if (hasTransactions) {
    return res
      .status(400)
      .json({ error: "Cannot delete a booth that has recorded transactions" });
  }

  const result = db
    .prepare("DELETE FROM booths WHERE id = ?")
    .run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Booth not found" });
  }
  res.json({ message: "Booth deleted successfully" });
});

module.exports = router;
