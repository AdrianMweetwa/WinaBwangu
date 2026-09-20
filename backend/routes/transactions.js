const express = require("express"); // Import the Express library to create a web server

const db = require("../db"); // Import the database connection object from db.js

const router = express.Router(); // Create a new router object to handle routes related to transactions

// Define a route to handle GET requests to the root URL ("/")
// Get all transactions from the database and send them as a JSON response
// The route retrieves all transactions from the database, including the associated booth and service information
// The SQL query uses INNER JOINs to combine data from the transactions, booths, and services tables based on their respective IDs
// The results are ordered by the transaction ID in descending order, so the most recent transactions appear first

router.get("/", (req, res) => {
  const transactions = db
    .prepare(
      "SELECT * FROM transactions INNER JOIN booths ON transactions.booth_id = booths.id INNER JOIN services ON transactions.service_id = services.id ORDER BY transactions.id DESC",
    )
    .all(); // Retrieve all transactions from the database

  res.json(transactions); // Send a JSON response containing the list of transactions
});

// Define a route to handle POST requests to the root URL ("/")
// This route adds a new transaction to the database

router.post("/", (req, res) => {
  const {
    transaction_id,
    transaction_type,
    booth_id,
    service_id,
    transaction_amount,
    phone_number,
    account_number,
    transaction_tax,
    transaction_amount_after_tax,
    transaction_revenue,
    transaction_date,
  } = req.body; // Extract the required fields from the request body

  // Check that all required fields were provided

  if (
    !transaction_id ||
    !transaction_type ||
    transaction_amount === undefined ||
    phone_number === undefined ||
    account_number === undefined ||
    transaction_tax === undefined ||
    transaction_amount_after_tax === undefined ||
    transaction_revenue === undefined ||
    !booth_id ||
    !service_id ||
    !transaction_date
  ) {
    return res.status(400).json({
      error: "All transaction fields are required",
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
        transaction_tax,
        transaction_amount_after_tax,
        transaction_revenue,
        transaction_date,
      );

    // Send a success response after the transaction is added

    res.status(201).json({
      message: "Transaction added successfully",
      id: result.lastInsertRowid,
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
