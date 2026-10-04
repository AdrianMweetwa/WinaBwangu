import { state } from "./state.js";

export function generateTransactionId() {
  const highestSeedNumber = state.transactions.reduce((highest, transaction) => {
    const match = String(transaction.transaction_id || "").match(/^WB(\d+)$/i);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  return `WB${String(highestSeedNumber + 1).padStart(7, "0")}`;
}
