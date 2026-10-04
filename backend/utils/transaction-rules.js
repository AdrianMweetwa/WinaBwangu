// We keep the assignment-wide transaction rules on the server so that a browser
// cannot change the tax or revenue figures before storage.
const TRANSACTION_TAX_RATE = 0.16;

function calculateTransactionAmounts(amount, revenueRate) {
  const numericAmount = Number(amount);
  const numericRevenueRate = Number(revenueRate);
  const tax = Number((numericAmount * TRANSACTION_TAX_RATE).toFixed(2));
  const amountAfterTax = Number((numericAmount - tax).toFixed(2));
  const revenue = Number((numericAmount * numericRevenueRate).toFixed(2));

  return { tax, amountAfterTax, revenue };
}

module.exports = { TRANSACTION_TAX_RATE, calculateTransactionAmounts };
