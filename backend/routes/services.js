const express = require('express'); // Import the Express library to create a web server
const db = require('../db'); // Import the database connection object from db.js
const router = express.Router(); // Create a new router object to handle routes related to services

router.get('/', (req, res) => {
  const services = db.prepare('SELECT * FROM services ORDER BY id').all(); // Retrieve all services from the database
  res.json(services); // Send a JSON response containing the list of services
});

// Create a new service
router.post('/', (req, res) => {
  const { service, monthly_transaction_limit, revenue_rate, identifier_type } = req.body;

  if (!service || monthly_transaction_limit === undefined || revenue_rate === undefined) {
    return res.status(400).json({
      error: "service, monthly_transaction_limit and revenue_rate are required",
    });
  }

  try {
    const result = db
      .prepare(
        "INSERT INTO services (service, monthly_transaction_limit, revenue_rate, identifier_type) VALUES (?, ?, ?, ?)",
      )
      .run(service, monthly_transaction_limit, revenue_rate, identifier_type === "account" ? "account" : "phone");

    res.status(201).json({ message: "Service created successfully", id: result.lastInsertRowid });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(400).json({ error: "A service with this name already exists" });
    }
    console.error("Service create error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a service, unless it already has transaction history
router.delete('/:id', (req, res) => {
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