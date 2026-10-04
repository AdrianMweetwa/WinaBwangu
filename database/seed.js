// We seed the case-study reference data for our Wina Bwangu project.
const db = require("../backend/db");
const { hashPassword } = require("../backend/utils/password");
const { calculateTransactionAmounts } = require("../backend/utils/transaction-rules");

const booths = [
  ["Wina1", "Lusaka CPD"],
  ["Wina2", "Libala"],
  ["Wina3", "Kabwata"],
  ["Wina4", "Mandevu"],
  ["Wina5", "Woodlands"],
  ["Wina6", "Matero East"],
];

const services = [
  ["Airtel Money", 350000, 0.05, "phone"],
  ["MTN Money", 160000, 0.06, "phone"],
  ["Zamtel Money", 70000, 0.045, "phone"],
  ["Zanaco", 80000, 0.035, "account"],
  ["FNB", 80000, 0.04, "account"],
];

const boothServices = [
  ["Wina1", "Airtel Money", "MTN Money", "Zamtel Money", "Zanaco", "FNB"],
  ["Wina2", "Airtel Money", "MTN Money", "Zamtel Money", "FNB"],
  ["Wina3", "Airtel Money", "MTN Money", "Zamtel Money", "Zanaco", "FNB"],
  ["Wina4", "Airtel Money", "MTN Money", "Zamtel Money"],
  ["Wina5", "Airtel Money", "MTN Money", "Zanaco", "FNB"],
  ["Wina6", "Airtel Money", "MTN Money", "Zamtel Money"],
];

// Appendix 1 rows: [reference, booth, service, revenue rate, amount].
const appendixTransactions = require("./appendix-transactions");

const insertBooth = db.prepare(
  "INSERT OR IGNORE INTO booths (booth, location) VALUES (?, ?)",
);
for (const [booth, location] of booths) {
  insertBooth.run(booth, location);
}

const insertService = db.prepare(
  "INSERT OR IGNORE INTO services (service, monthly_transaction_limit, revenue_rate, identifier_type) VALUES (?, ?, ?, ?)",
);
for (const service of services) {
  insertService.run(...service);
}

const findBooth = db.prepare("SELECT id FROM booths WHERE booth = ?");
const findService = db.prepare("SELECT id, revenue_rate FROM services WHERE service = ?");
const insertBoothService = db.prepare(
  "INSERT OR IGNORE INTO booth_services (booth_id, service_id) VALUES (?, ?)",
);

for (const [boothCode, ...serviceNames] of boothServices) {
  const booth = findBooth.get(boothCode);
  for (const serviceName of serviceNames) {
    const service = findService.get(serviceName);
    insertBoothService.run(booth.id, service.id);
  }
}

function expectedTransactionId(index) {
  return `WB${String(index).padStart(7, "0")}`;
}

const insertTransaction = db.prepare(`
  INSERT INTO transactions (
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
    transaction_date
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const seedTransactions = db.transaction(() => {
  // Replace existing sample rows with our exact Appendix 1 dataset.
  db.prepare("DELETE FROM transactions").run();

  for (const transaction of appendixTransactions) {
    const booth = findBooth.get(transaction.booth_code);
    const service = findService.get(transaction.service_name);
    if (!booth || !service) {
      throw new Error(`Appendix row ${transaction.transaction_id} references missing booth/service`);
    }
    if (Math.abs(Number(service.revenue_rate) - transaction.revenue_rate) > 0.000001) {
      throw new Error(`Revenue rate mismatch for ${transaction.transaction_id} (${transaction.service_name})`);
    }
    if (transaction.transaction_id !== expectedTransactionId(Number(transaction.transaction_id.slice(2)))) {
      throw new Error(`Invalid transaction reference ${transaction.transaction_id}`);
    }
    if (transaction.booth_id !== booth.id || transaction.service_id !== service.id) {
      throw new Error(`Foreign-key mismatch for ${transaction.transaction_id}`);
    }
    const calculated = calculateTransactionAmounts(
      transaction.transaction_amount,
      service.revenue_rate,
    );

    insertTransaction.run(
      transaction.transaction_id,
      transaction.transaction_type,
      transaction.booth_id,
      transaction.service_id,
      transaction.transaction_amount,
      transaction.phone_number,
      transaction.account_number,
      calculated.tax,
      calculated.amountAfterTax,
      calculated.revenue,
      transaction.transaction_date,
    );
  }
});
seedTransactions();

// Keep our demo users available for testing the Users page.
const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users
    (username, full_name, email, password_hash, role, company, assigned_booths, assigned_services, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
`);
const demoPasswordHash = hashPassword("password123");

insertUser.run("admin", "Mweetwa Chinene", "admin@gmail.com", demoPasswordHash, "system_admin", null, "", "");
insertUser.run(
  "admin_agent",
  "Mweetwa Chinene",
  "admin_agent@gmail.com",
  demoPasswordHash,
  "admin_agent",
  "Wina Bwangu",
  "Wina1,Wina2,Wina3",
  "Airtel Money,MTN Money,Zamtel Money,Zanaco,FNB",
);
insertUser.run(
  "agent",
  "Mweetwa Chinene",
  "agent@gmail.com",
  demoPasswordHash,
  "agent",
  "Wina Bwangu",
  "Wina4",
  "Airtel Money,MTN Money,Zamtel Money",
);

console.log(`Database seeded successfully with ${appendixTransactions.length} Appendix 1 transactions.`);
