import { state, transactionPagination } from "./state.js";
import { loadCoreData } from "./data-loader.js";
import { formatDateTime, money } from "./formatters.js";
import { showReceipt } from "./receipt.js";

export async function renderTransactions() {
  try {
    await loadCoreData();
  } catch (err) {
    console.error("Failed to load transactions:", err);
    return;
  }
  const boothFilter = document.getElementById("booth-filter");
  boothFilter.innerHTML = '<option value="">All Booths</option>';
  state.booths.forEach((booth) => {
    boothFilter.innerHTML += `<option value="${booth.booth}">${booth.booth}</option>`;
  });
  const serviceFilter = document.getElementById("service-filter");
  serviceFilter.innerHTML = '<option value="">All Services</option>';
  state.services.forEach((service) => {
    serviceFilter.innerHTML += `<option value="${service.service}">${service.service}</option>`;
  });
  applyTransactionFilters();
}

export function applyTransactionFilters() {
  const search = document.getElementById("transaction-search").value.trim().toLowerCase();
  const type = document.getElementById("transaction-type-filter").value;
  const booth = document.getElementById("booth-filter").value;
  const service = document.getElementById("service-filter").value;
  const start = document.getElementById("start-date-filter").value;
  const end = document.getElementById("end-date-filter").value;
  const filtered = state.transactions.filter((transaction) => {
    if (type && transaction.transaction_type !== type) return false;
    if (booth && transaction.booth !== booth) return false;
    if (service && transaction.service !== service) return false;
    if (search && !`${transaction.transaction_id} ${transaction.transaction_type} ${transaction.phone_number} ${transaction.account_number} ${transaction.booth} ${transaction.location} ${transaction.service}`.toLowerCase().includes(search)) return false;
    const day = transaction.transaction_date.slice(0, 10);
    if (start && day < start) return false;
    if (end && day > end) return false;
    return true;
  });
  transactionPagination.rows = filtered;
  transactionPagination.page = 1;
  renderTransactionsTable();
  renderTransactionsOverview(filtered);
}

function renderTransactionPagination(totalPages) {
  const pagination = document.getElementById("transaction-pagination");
  const status = document.getElementById("transaction-page-status");
  const previous = document.getElementById("transaction-prev");
  const next = document.getElementById("transaction-next");
  const hasPages = transactionPagination.rows.length > 0;
  pagination.hidden = !hasPages;
  status.textContent = `Page ${transactionPagination.page} of ${totalPages}`;
  previous.disabled = transactionPagination.page <= 1;
  next.disabled = transactionPagination.page >= totalPages;
}

function renderTransactionsTable() {
  const tbody = document.getElementById("transactions-tbody");
  tbody.innerHTML = "";
  const rows = transactionPagination.rows;
  if (rows.length === 0) {
    tbody.innerHTML = '<tr class="empty-table-row"><td colspan="7">No transactions found</td></tr>';
    renderTransactionPagination(1);
    return;
  }
  const totalPages = Math.ceil(rows.length / transactionPagination.pageSize);
  transactionPagination.page = Math.min(transactionPagination.page, totalPages);
  const start = (transactionPagination.page - 1) * transactionPagination.pageSize;
  rows.slice(start, start + transactionPagination.pageSize).forEach((transaction) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${transaction.transaction_id}</td><td>${transaction.transaction_type === "deposit" ? "Deposit" : "Withdrawal"}</td><td>${formatDateTime(transaction.transaction_date)}</td><td>${transaction.booth}</td><td>${transaction.service}</td><td>${money(transaction.transaction_amount)}</td><td><button type="button" class="user-action-btn view-transaction-btn">View</button></td>`;
    row.querySelector(".view-transaction-btn").addEventListener("click", () => showReceipt(transaction));
    tbody.appendChild(row);
  });
  renderTransactionPagination(totalPages);
}

export function changeTransactionPage(offset) {
  const totalPages = Math.max(1, Math.ceil(transactionPagination.rows.length / transactionPagination.pageSize));
  transactionPagination.page = Math.min(Math.max(transactionPagination.page + offset, 1), totalPages);
  renderTransactionsTable();
}

function renderTransactionsOverview(rows) {
  const deposits = rows.filter((transaction) => transaction.transaction_type === "deposit");
  const withdrawals = rows.filter((transaction) => transaction.transaction_type === "withdrawal");
  document.getElementById("overview-total-count").textContent = rows.length;
  document.getElementById("overview-total-deposits").textContent = money(deposits.reduce((sum, transaction) => sum + Number(transaction.transaction_amount), 0));
  document.getElementById("overview-total-withdrawals").textContent = money(withdrawals.reduce((sum, transaction) => sum + Number(transaction.transaction_amount), 0));
  document.getElementById("overview-total-revenue").textContent = money(rows.reduce((sum, transaction) => sum + Number(transaction.transaction_revenue), 0));
}

export function exportTransactionsCsv() {
  const header = ["Transaction ID", "Type", "Date", "Booth", "Location", "Service", "Amount", "Revenue"];
  const lines = [header.join(",")];
  state.transactions.forEach((transaction) => {
    lines.push([
      transaction.transaction_id,
      transaction.transaction_type,
      transaction.transaction_date,
      transaction.booth,
      transaction.location,
      transaction.service,
      transaction.transaction_amount,
      transaction.transaction_revenue,
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "wina-bwangu-transactions.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export function setupTransactions() {
  ["transaction-search", "transaction-type-filter", "booth-filter", "service-filter", "start-date-filter", "end-date-filter"].forEach((id) => {
    document.getElementById(id).addEventListener("input", applyTransactionFilters);
    document.getElementById(id).addEventListener("change", applyTransactionFilters);
  });
  document.getElementById("transaction-prev").addEventListener("click", () => changeTransactionPage(-1));
  document.getElementById("transaction-next").addEventListener("click", () => changeTransactionPage(1));
  document.getElementById("print-transactions").addEventListener("click", () => window.print());
  document.getElementById("export-transactions").addEventListener("click", exportTransactionsCsv);
}
