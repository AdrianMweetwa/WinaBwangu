const express = require('express'); // Import the Express library to create a web server
const db = require('../db'); // Import the database connection object from db.js
const { isNonEmptyString, isFiniteNumber, isPositiveInteger, VALID_IDENTIFIER_TYPES } = require('../utils/validation');
const { isSystemAdmin, requireCapability } = require("../middleware/auth");
const router = express.Router(); // Create a new router object to handle routes related to services

router.get('/', requireCapability("catalog.view"), (req, res) => {
  let services = db.prepare('SELECT * FROM services ORDER BY id').all(); // Retrieve all services from the database
  if (!isSystemAdmin(req.user)) {
    const allowed = String(req.user.assigned_services || "").split(",").filter(Boolean);
    services = services.filter((service) => allowed.includes(service.service));
  }
  res.json(services); // Send a JSON response containing the list of services
});

// Create a new service
router.post('/', requireCapability("settings.write"), (req, res) => {
  const { service, monthly_transaction_limit, revenue_rate, identifier_type } = req.body;

  if (
    !isNonEmptyString(service, 100) ||
    !isFiniteNumber(monthly_transaction_limit, { min: 0 }) ||
    !isFiniteNumber(revenue_rate, { min: 0, max: 1 })
  ) {
    return res.status(400).json({
      error: "service, monthly_transaction_limit and revenue_rate must be valid",
    });
  }
  if (identifier_type !== undefined && !VALID_IDENTIFIER_TYPES.includes(identifier_type)) {
    return res.status(400).json({ error: "identifier_type must be phone or account" });
  }

  try {
    const result = db
      .prepare(
        "INSERT INTO services (service, monthly_transaction_limit, revenue_rate, identifier_type) VALUES (?, ?, ?, ?)",
      )
      .run(service.trim(), monthly_transaction_limit, revenue_rate, identifier_type === "account" ? "account" : "phone");

    res.status(201).json({ message: "Service created successfully", id: result.lastInsertRowid });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(400).json({ error: "A service with this name already exists" });
    }
    console.error("Service create error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Update a service definition.
router.put('/:id', requireCapability("settings.write"), (req, res) => {
  const { service, monthly_transaction_limit, revenue_rate, identifier_type } = req.body;
  if (!isPositiveInteger(req.params.id)) {
    return res.status(400).json({ error: "A valid service id is required" });
  }
  if (
    !isNonEmptyString(service, 100) ||
    !isFiniteNumber(monthly_transaction_limit, { min: 0 }) ||
    !isFiniteNumber(revenue_rate, { min: 0, max: 1 }) ||
    !VALID_IDENTIFIER_TYPES.includes(identifier_type)
  ) {
    return res.status(400).json({ error: "All service fields must be valid" });
  }

  const existing = db.prepare("SELECT id FROM services WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Service not found" });

  try {
    db.prepare(
      "UPDATE services SET service = ?, monthly_transaction_limit = ?, revenue_rate = ?, identifier_type = ? WHERE id = ?",
    ).run(service.trim(), monthly_transaction_limit, revenue_rate, identifier_type, req.params.id);
    res.json({ message: "Service updated successfully" });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(400).json({ error: "A service with this name already exists" });
    }
    console.error("Service update error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a service, unless it already has transaction history
router.delete('/:id', requireCapability("settings.write"), (req, res) => {
  if (!isPositiveInteger(req.params.id)) {
    return res.status(400).json({ error: "A valid service id is required" });
  }
  const hasTransactions = db
    .prepare("SELECT 1 FROM transactions WHERE service_id = ? LIMIT 1")
    .get(req.params.id);
  if (hasTransactions) {
    return res.status(400).json({ error: "Cannot delete a service that has recorded transactions" });
  }

  const result = db.prepare("DELETE FROM services WHERE id = ?").run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Service not found" });
  }
  res.json({ message: "Service deleted successfully" });
});

module.exports = router; // Export the router object so that it can be used in other parts of the application
