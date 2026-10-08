const express = require("express");

const db = require("../db");
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

const router = express.Router();

router.get("/", requireCapability("transactions.view"), (req, res) => {
  const filters = [];
  const parameters = [];
  if (!isSystemAdmin(req.user)) {
    const booths = String(req.user.assigned_booths || "")
      .split(",")
      .map((value) => String(value).trim())
      .filter(Boolean);
    const services = String(req.user.assigned_services || "")
      .split(",")
      .map((value) => String(value).trim())
      .map((value) => value.replace(/\bZannaco\b/gi, "Zanaco"))
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
    .all(...parameters);

  res.json(transactions);
});

router.get(
  "/:transactionId",
  requireCapability("transactions.view"),
  (req, res) => {
    const transaction = db
      .prepare(
        `SELECT transactions.id, transactions.transaction_id,
                transactions.transaction_type, transactions.booth_id,
                transactions.service_id, transactions.transaction_amount,
                transactions.phone_number, transactions.account_number,
                transactions.transaction_tax,
                transactions.transaction_amount_after_tax,
                transactions.transaction_revenue, transactions.transaction_date,
                booths.booth, booths.location, services.service,
                services.identifier_type, services.revenue_rate
         FROM transactions
         INNER JOIN booths ON transactions.booth_id = booths.id
         INNER JOIN services ON transactions.service_id = services.id
         WHERE transactions.transaction_id = ?`,
      )
      .get(req.params.transactionId);

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    if (!hasAssignedAccess(req.user, transaction.booth, transaction.service)) {
      return res
        .status(403)
        .json({ error: "You do not have access to this transaction" });
    }

    res.json(transaction);
  },
);

router.post("/", requireCapability("transactions.create"), (req, res) => {
  const {
    transaction_type,
    booth_id,
    service_id,
    transaction_amount,
    phone_number,
    account_number,
    transaction_date,
  } = req.body;

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

  const booth = db.prepare("SELECT * FROM booths WHERE id = ?").get(booth_id);

  if (!booth) {
    return res.status(400).json({
      error: "Booth not found",
    });
  }

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

    res.status(201).json({
      message: "Transaction added successfully",
      id: result.lastInsertRowid,
      calculation: calculated,
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(400).json({
        error: "Transaction with this ID already exists",
      });
    }

    console.error("Transaction error:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});

router.put(
  "/:transactionId",
  requireCapability("transactions.update"),
  (req, res) => {
    const existing = db
      .prepare(
        `SELECT transactions.transaction_id, booths.booth, services.service
         FROM transactions
         INNER JOIN booths ON transactions.booth_id = booths.id
         INNER JOIN services ON transactions.service_id = services.id
         WHERE transactions.transaction_id = ?`,
      )
      .get(req.params.transactionId);

    if (!existing) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    if (!hasAssignedAccess(req.user, existing.booth, existing.service)) {
      return res
        .status(403)
        .json({ error: "You do not have access to this transaction" });
    }

    const {
      transaction_type,
      booth_id,
      service_id,
      transaction_amount,
      phone_number,
      account_number,
      transaction_date,
    } = req.body;

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

    const booth = db.prepare("SELECT * FROM booths WHERE id = ?").get(booth_id);
    if (!booth) return res.status(400).json({ error: "Booth not found" });

    const service = db
      .prepare("SELECT * FROM services WHERE id = ?")
      .get(service_id);
    if (!service) return res.status(400).json({ error: "Service not found" });

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

    db.prepare(
      `UPDATE transactions SET
        transaction_type = ?, booth_id = ?, service_id = ?,
        transaction_amount = ?, phone_number = ?, account_number = ?,
        transaction_tax = ?, transaction_amount_after_tax = ?,
        transaction_revenue = ?, transaction_date = ?
       WHERE transaction_id = ?`,
    ).run(
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
      existing.transaction_id,
    );

    res.json({
      message: "Transaction updated successfully",
      calculation: calculated,
    });
  },
);

router.delete(
  "/:transactionId",
  requireCapability("transactions.delete"),
  (req, res) => {
    const transaction = db
      .prepare(
        `SELECT transactions.transaction_id, booths.booth, services.service
         FROM transactions
         INNER JOIN booths ON transactions.booth_id = booths.id
         INNER JOIN services ON transactions.service_id = services.id
         WHERE transactions.transaction_id = ?`,
      )
      .get(req.params.transactionId);

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    if (!hasAssignedAccess(req.user, transaction.booth, transaction.service)) {
      return res
        .status(403)
        .json({ error: "You do not have access to this transaction" });
    }

    db.prepare("DELETE FROM transactions WHERE transaction_id = ?").run(
      transaction.transaction_id,
    );
    res.json({ message: "Transaction deleted successfully" });
  },
);

module.exports = router;
