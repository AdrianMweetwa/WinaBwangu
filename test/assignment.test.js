const test = require("node:test");
const assert = require("node:assert/strict");

const appendixTransactions = require("../database/appendix-transactions");
const {
  TRANSACTION_TAX_RATE,
  calculateTransactionAmounts,
} = require("../backend/utils/transaction-rules");

test("Appendix 1 contains the required 308 sequential transaction references", () => {
  assert.equal(appendixTransactions.length, 308);
  appendixTransactions.forEach((transaction, index) => {
    assert.equal(transaction.transaction_id, `WB${String(index + 1).padStart(7, "0")}`);
  });
});

test("transaction calculations apply the assignment 16 percent tax", () => {
  assert.equal(TRANSACTION_TAX_RATE, 0.16);
  assert.deepEqual(calculateTransactionAmounts(1000, 0.05), {
    tax: 160,
    amountAfterTax: 840,
    revenue: 50,
  });
});

test("transaction calculations round stored monetary values to two decimals", () => {
  assert.deepEqual(calculateTransactionAmounts(123.45, 0.045), {
    tax: 19.75,
    amountAfterTax: 103.7,
    revenue: 5.56,
  });
});
