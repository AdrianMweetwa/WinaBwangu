// Shared transaction rules used by the API and seed data.
const TRANSACTION_TAX_RATE = 0.16;

function calculateTransactionAmounts(amount, revenueRate) {
  const numericAmount = Number(amount);
  const numericRevenueRate = Number(revenueRate);
  const tax = Number((numericAmount * TRANSACTION_TAX_RATE).toFixed(2));
  const amountAfterTax = Number((numericAmount - tax).toFixed(2));
  const revenue = Number((numericAmount * numericRevenueRate).toFixed(2));

  return { tax, amountAfterTax, revenue };
}

function nextTransactionId(db) {
  const latest = db
    .prepare("SELECT transaction_id FROM transactions ORDER BY id DESC LIMIT 1")
    .get();
  const latestNumber = latest
    ? Number(String(latest.transaction_id).replace(/^WB/i, ""))
    : 0;
  return `WB${String(latestNumber + 1).padStart(7, "0")}`;
}

module.exports = {
  TRANSACTION_TAX_RATE,
  calculateTransactionAmounts,
  nextTransactionId,
};
