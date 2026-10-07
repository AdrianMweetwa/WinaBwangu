const express = require("express"); // Import the Express library to create a web server

const db = require("../db"); // Import the database connection object from db.js
const {
  isFiniteNumber,
  isNonEmptyString,
  isPositiveInteger,
  isValidDateString,
  VALID_TRANSACTION_TYPES,
} = require("../utils/validation");
const {
  hasAssignedAccess,
  isSystemAdmin,
  requireCapability,
} = require("../middleware/auth");
const {
  calculateTransactionAmounts,
  nextTransactionId,
} = require("../utils/transaction-rules");

const router = express.Router(); // Create a new router object to handle routes related to transactions

// Define a route to handle GET requests to the root URL ("/")
// Get all transactions from the database and send them as a JSON response
// The route retrieves all transactions from the database, including the associated booth and service information
// The SQL query uses INNER JOINs to combine data from the transactions, booths, and services tables based on their respective IDs
// The results are ordered by the transaction ID in descending order, so the most recent transactions appear first

router.get("/", requireCapability("transactions.view"), (req, res) => {
  const filters = [];
  const parameters = [];
  if (!isSystemAdmin(req.user)) {
    const booths = String(req.user.assigned_booths || "")
      .split(",")
      .filter(Boolean);
    const services = String(req.user.assigned_services || "")
      .split(",")
      .filter(Boolean);
    if (booths.length === 0 || services.length === 0) return res.json([]);
    filters.push(`booths.booth IN (${booths.map(() => "?").join(",")})`);
    parameters.push(...booths);
    filters.push(`services.service IN (${services.map(() => "?").join(",")})`);
    parameters.push(...services);
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const transactions = db
    .prepare(
      `SELECT * FROM transactions INNER JOIN booths ON transactions.booth_id = booths.id INNER JOIN services ON transactions.service_id = services.id ${where} ORDER BY transactions.id DESC`,
    )
    .all(...parameters); // Retrieve only transactions within the signed-in user's scope

  res.json(transactions); // Send a JSON response containing the list of transactions
});

// Define a route to handle POST requests to the root URL ("/")
// This route adds a new transaction to the database

router.post("/", requireCapability("transactions.create"), (req, res) => {
  const {
    transaction_type,
    booth_id,
    service_id,
    transaction_amount,
    phone_number,
    account_number,
    transaction_date,
  } = req.body; // Extract the required fields from the request body

  // The server owns the transaction ID so stale browser state cannot reuse one.
  const transaction_id = nextTransactionId(db);

  if (!VALID_TRANSACTION_TYPES.includes(transaction_type)) {
    return res.status(400).json({ error: "transaction_type must be valid" });
  }
  if (!isPositiveInteger(booth_id) || !isPositiveInteger(service_id)) {
    return res
      .status(400)
      .json({ error: "A valid booth and service are required" });
  }
  if (
    !isFiniteNumber(transaction_amount, { min: Number.EPSILON }) ||
    !isValidDateString(transaction_date) ||
    typeof phone_number !== "string" ||
    typeof account_number !== "string"
  ) {
    return res.status(400).json({
      error:
        "Transaction amounts, date and customer contact fields must be valid",
    });
  }

  // Check that the booth_id exists in the booths table

  const booth = db.prepare("SELECT * FROM booths WHERE id = ?").get(booth_id);

  if (!booth) {
    return res.status(400).json({
      error: "Booth not found",
    });
  }

  // Check that the service_id exists in the services table

  const service = db
    .prepare("SELECT * FROM services WHERE id = ?")
    .get(service_id);

  if (!service) {
    return res.status(400).json({
      error: "Service not found",
    });
  }

  if (!hasAssignedAccess(req.user, booth.booth, service.service)) {
    return res
      .status(403)
      .json({ error: "You do not have access to this booth and service" });
  }

  const serviceAtBooth = db
    .prepare(
      "SELECT 1 FROM booth_services WHERE booth_id = ? AND service_id = ?",
    )
    .get(booth_id, service_id);
  if (!serviceAtBooth) {
    return res
      .status(400)
      .json({ error: "The selected service is not available at this booth" });
  }

  const calculated = calculateTransactionAmounts(
    transaction_amount,
    service.revenue_rate,
  );

  try {
    // Insert the transaction into the database

    const result = db
      .prepare(
        "INSERT INTO transactions (transaction_id, transaction_type, booth_id, service_id, transaction_amount, phone_number, account_number, transaction_tax, transaction_amount_after_tax, transaction_revenue, transaction_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        transaction_id,
        transaction_type,
        booth_id,
        service_id,
        transaction_amount,
        phone_number,
        account_number,
        calculated.tax,
        calculated.amountAfterTax,
        calculated.revenue,
        transaction_date,
      );

    // Send a success response after the transaction is added

    res.status(201).json({
      message: "Transaction added successfully",
      id: result.lastInsertRowid,
      calculation: calculated,
    });
  } catch (error) {
    // Handle duplicate transaction ID
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(400).json({
        error: "Transaction with this ID already exists",
      });
    }

    // Show the actual database error
    console.error("Transaction error:", error);

    // Handle any other database errors
    res.status(500).json({
      error: error.message,
    });
  }
});

module.exports = router; // Export the router object so that it can be used in other parts of the application
