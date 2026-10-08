import { state, transactionPagination } from "./state.js";
import { loadCoreData } from "./data-loader.js";
import { formatDateTime, money } from "./formatters.js";
import { showReceipt } from "./receipt.js";
import { api } from "./api.js";
import { canPerform } from "./auth.js";
import { closeModal, openCrudConfirmation, openModal, showCrudSuccess } from "./modal.js";

let editingTransaction = null;

function toDateTimeInput(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function syncEditCustomerFields() {
  const serviceId = Number(document.getElementById("edit-transaction-service").value);
  const service = state.services.find((entry) => entry.id === serviceId);
  const isAccountService = service?.identifier_type === "account";
  document.getElementById("edit-phone-group").hidden = isAccountService;
  document.getElementById("edit-account-group").hidden = !isAccountService;
}

function openTransactionEditor(transaction) {
  editingTransaction = transaction;
  const boothSelect = document.getElementById("edit-transaction-booth");
  const serviceSelect = document.getElementById("edit-transaction-service");
  boothSelect.innerHTML = state.booths
    .map((booth) => `<option value="${booth.id}">${booth.booth} - ${booth.location}</option>`)
    .join("");
  serviceSelect.innerHTML = state.services
    .map((service) => `<option value="${service.id}">${service.service}</option>`)
    .join("");

  document.getElementById("edit-transaction-type").value = transaction.transaction_type;
  boothSelect.value = String(transaction.booth_id);
  serviceSelect.value = String(transaction.service_id);
  document.getElementById("edit-transaction-amount").value = transaction.transaction_amount;
  document.getElementById("edit-phone-number").value = transaction.phone_number || "";
  document.getElementById("edit-account-number").value = transaction.account_number || "";
  document.getElementById("edit-transaction-date").value = toDateTimeInput(transaction.transaction_date);
  syncEditCustomerFields();
  openModal(document.getElementById("transaction-edit-modal"));
}

async function saveEditedTransaction() {
  if (!editingTransaction) return;
  const transactionDateValue = document.getElementById("edit-transaction-date").value;
  const transactionDate = new Date(transactionDateValue);
  if (!transactionDateValue || Number.isNaN(transactionDate.getTime())) {
    alert("Enter a valid transaction date and time.");
    return;
  }
  const serviceId = Number(document.getElementById("edit-transaction-service").value);
  const service = state.services.find((entry) => entry.id === serviceId);
  const isAccountService = service?.identifier_type === "account";
  const payload = {
    transaction_type: document.getElementById("edit-transaction-type").value,
    booth_id: Number(document.getElementById("edit-transaction-booth").value),
    service_id: serviceId,
    transaction_amount: Number(document.getElementById("edit-transaction-amount").value),
    phone_number: isAccountService ? "" : document.getElementById("edit-phone-number").value.trim(),
    account_number: isAccountService ? document.getElementById("edit-account-number").value.trim() : "",
    transaction_date: transactionDate.toISOString(),
  };

  const saveButton = document.getElementById("save-transaction-edit");
  saveButton.disabled = true;
  try {
    await api.put(`/api/transactions/${encodeURIComponent(editingTransaction.transaction_id)}`, payload);
    closeModal(document.getElementById("transaction-edit-modal"));
    editingTransaction = null;
    await renderTransactions();
    showCrudSuccess("Transaction Updated", "The transaction was updated successfully.");
  } catch (error) {
    alert(error.message || "The transaction could not be updated.");
  } finally {
    saveButton.disabled = false;
  }
}

function confirmDeleteTransaction(transaction) {
  openCrudConfirmation({
    title: "Delete Transaction",
    subtitle: "This removes the transaction from the local assignment database.",
    message: `Delete transaction ${transaction.transaction_id}?`,
    confirmLabel: "Delete Transaction",
    successTitle: "Transaction Deleted",
    successMessage: `${transaction.transaction_id} was deleted successfully.`,
    run: async () => {
      await api.delete(`/api/transactions/${encodeURIComponent(transaction.transaction_id)}`);
      await renderTransactions();
    },
  });
}

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
    const actions = ['<button type="button" class="user-action-btn view-transaction-btn">View</button>'];
    if (canPerform("transactions.update")) {
      actions.push('<button type="button" class="user-action-btn edit-transaction-btn">Edit</button>');
    }
    if (canPerform("transactions.delete")) {
      actions.push('<button type="button" class="user-action-btn delete delete-transaction-btn">Delete</button>');
    }
    row.innerHTML = `<td>${transaction.transaction_id}</td><td>${transaction.transaction_type === "deposit" ? "Deposit" : "Withdrawal"}</td><td>${formatDateTime(transaction.transaction_date)}</td><td>${transaction.booth}</td><td>${transaction.service}</td><td>${money(transaction.transaction_amount)}</td><td><div class="transaction-actions">${actions.join("")}</div></td>`;
    row.querySelector(".view-transaction-btn").addEventListener("click", () => showReceipt(transaction));
    row.querySelector(".edit-transaction-btn")?.addEventListener("click", () => openTransactionEditor(transaction));
    row.querySelector(".delete-transaction-btn")?.addEventListener("click", () => confirmDeleteTransaction(transaction));
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
  document.getElementById("edit-transaction-service").addEventListener("change", syncEditCustomerFields);
  document.getElementById("save-transaction-edit").addEventListener("click", saveEditedTransaction);
  document.getElementById("print-transactions").addEventListener("click", () => window.print());
  document.getElementById("export-transactions").addEventListener("click", exportTransactionsCsv);
}
