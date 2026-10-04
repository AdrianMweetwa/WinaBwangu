const TAX_STORAGE_KEY = "wb_transaction_tax_percent";
export const DEFAULT_TRANSACTION_TAX_PERCENT = 16;

export function transactionTaxPercent() {
  const stored = localStorage.getItem(TAX_STORAGE_KEY);
  const value = stored === null ? DEFAULT_TRANSACTION_TAX_PERCENT : Number(stored);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_TRANSACTION_TAX_PERCENT;
}

export function setTransactionTaxPercent(value) {
  localStorage.setItem(TAX_STORAGE_KEY, String(value));
}
