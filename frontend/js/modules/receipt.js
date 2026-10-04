import { state } from "./state.js";
import { formatDateTime, money, percent } from "./formatters.js";
import { openModal } from "./modal.js";

export function showReceipt(transaction) {
  document.getElementById("receipt-transaction-id").textContent = transaction.transaction_id;
  document.getElementById("receipt-type").textContent = transaction.transaction_type === "deposit" ? "Cash Deposit" : "Cash Withdrawal";
  document.getElementById("receipt-date").textContent = formatDateTime(transaction.transaction_date);
  document.getElementById("receipt-booth").textContent = transaction.booth;
  document.getElementById("receipt-booth-id").textContent = transaction.booth_id ?? "-";
  document.getElementById("receipt-location").textContent = transaction.location;
  document.getElementById("receipt-service").textContent = transaction.service;
  document.getElementById("receipt-service-id").textContent = transaction.service_id ?? "-";
  document.getElementById("receipt-phone").textContent = transaction.phone_number || "-";
  document.getElementById("receipt-account").textContent = transaction.account_number || "-";
  const service = state.services.find((entry) => entry.service === transaction.service);
  document.getElementById("receipt-revenue-rate").textContent = service ? percent(service.revenue_rate) : "-";
  document.getElementById("receipt-fee-row").hidden = false;
  document.getElementById("receipt-amount-after-fee-row").hidden = false;
  document.getElementById("receipt-fee").textContent = money(transaction.transaction_tax);
  document.getElementById("receipt-amount-after-fee").textContent = money(transaction.transaction_amount_after_tax);
  document.getElementById("receipt-transaction-revenue").textContent = money(transaction.transaction_revenue);
  document.getElementById("receipt-amount").textContent = money(transaction.transaction_amount);
  openModal(document.getElementById("receipt-modal"));
}

export function setupReceiptPrinting() {
  const printButton = document.querySelector(".receipt-print-btn");
  if (!printButton) return;

  printButton.addEventListener("click", () => {
    document.body.classList.add("printing-receipt");
    const cleanup = () => document.body.classList.remove("printing-receipt");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    // Some browsers do not emit afterprint when printing is cancelled.
    window.setTimeout(cleanup, 1000);
  });
}
