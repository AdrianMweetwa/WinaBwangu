const express = require("express"); // Import the Express library to create a web server

const db = require("../db"); // Import the database connection object from db.js
const { isNonEmptyString, isPositiveInteger } = require("../utils/validation");
const { isSystemAdmin, requireCapability } = require("../middleware/auth");
const router = express.Router(); // Create a new router object to handle routes related to booths

router.get("/", requireCapability("catalog.view"), (req, res) => {
  let booths = db.prepare("SELECT * FROM booths ORDER BY id").all(); // Retrieve all booths from the database
  if (!isSystemAdmin(req.user)) {
    const allowed = String(req.user.assigned_booths || "").split(",").filter(Boolean);
    booths = booths.filter((booth) => allowed.includes(booth.booth));
  }
  res.json(booths); // Send a JSON response containing the list of booths
});

router.get("/:booth/services", requireCapability("catalog.view"), (req, res) => {
    const booth = db.prepare("SELECT * FROM booths WHERE booth = ?").get(req.params.booth); // Retrieve the booth with the specified booth code from the database
    if (!booth) {
        return res.status(404).json({ error: "Booth not found" }); // If the booth is not found, send a 404 response with an error message
    }
    if (!isSystemAdmin(req.user) && !String(req.user.assigned_booths || "").split(",").includes(booth.booth)) {
        return res.status(403).json({ error: "You do not have access to this booth" });
    }

    // Retrieve all services offered by the specified booth from the database
    // Use a JOIN query to get the services associated with the booth from the booth_services table
    // The query selects all columns from the services table and joins it with the booth_services table on the service_id
    // The WHERE clause filters the results to only include services associated with the specified booth_id
    let services = db.prepare(`
        SELECT * FROM services
        JOIN booth_services ON services.id = booth_services.service_id
        WHERE booth_services.booth_id = ? ORDER BY services.id
    `).all(booth.id); // Retrieve all services offered by the specified booth from the database
    if (!isSystemAdmin(req.user)) {
      const allowed = String(req.user.assigned_services || "").split(",").filter(Boolean);
      services = services.filter((service) => allowed.includes(service.service));
    }

    
    res.json({booth: booth, services: services }); // Send a JSON response containing the list of services offered by the specified booth
});


// Create a new booth and link it to the services it offers
router.post("/", requireCapability("settings.write"), (req, res) => {
  const { booth, location, services } = req.body;

  if (!isNonEmptyString(booth, 50) || !isNonEmptyString(location, 120)) {
    return res.status(400).json({ error: "booth and location are required and must be valid text" });
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

    res.status(201).json({ message: "Booth created successfully", id: result.lastInsertRowid });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(400).json({ error: "A booth with this code already exists" });
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
    return res.status(400).json({ error: "booth and location are required and must be valid text" });
  }
  if (services !== undefined && !Array.isArray(services)) {
    return res.status(400).json({ error: "services must be an array" });
  }

  const existing = db.prepare("SELECT id FROM booths WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Booth not found" });

  try {
    const updateBooth = db.prepare("UPDATE booths SET booth = ?, location = ? WHERE id = ?");
    const clearServices = db.prepare("DELETE FROM booth_services WHERE booth_id = ?");
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
      return res.status(400).json({ error: "A booth with this code already exists" });
    }
    console.error("Booth update error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a booth, unless it already has transaction history (to avoid silently
// wiping out financial records via the schema's ON DELETE CASCADE)
router.delete("/:id", requireCapability("settings.write"), (req, res) => {
  if (!isPositiveInteger(req.params.id)) {
    return res.status(400).json({ error: "A valid booth id is required" });
  }
  const hasTransactions = db
    .prepare("SELECT 1 FROM transactions WHERE booth_id = ? LIMIT 1")
    .get(req.params.id);
  if (hasTransactions) {
    return res.status(400).json({ error: "Cannot delete a booth that has recorded transactions" });
  }

  const result = db.prepare("DELETE FROM booths WHERE id = ?").run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Booth not found" });
  }
  res.json({ message: "Booth deleted successfully" });
});

module.exports = router; // Export the router object so that it can be used in other parts of the application
