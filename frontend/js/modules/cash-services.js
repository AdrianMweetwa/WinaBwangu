import { api } from "./api.js";
import { state } from "./state.js";
import { loadCoreData } from "./data-loader.js";
import { formatTime, isSameDay, money, percent } from "./formatters.js";
import { generateTransactionId } from "./transaction-utils.js";
import { transactionTaxPercent } from "./settings-storage.js";
import { closeModal, openModal, showCrudSuccess } from "./modal.js";
import { canPerform } from "./auth.js";

let selectedServiceForCash = null;
let pendingTransaction = null;

export async function renderCashServices() {
  try {
    if (state.booths.length === 0) await loadCoreData();
  } catch (err) {
    console.error("Failed to load cash services data:", err);
    return;
  }
  const boothSelect = document.getElementById("booth");
  boothSelect.innerHTML = '<option value="" selected disabled>Select Booth</option>';
  state.booths.forEach((booth) => {
    const option = document.createElement("option");
    option.value = booth.booth;
    option.textContent = `${booth.booth} — ${booth.location}`;
    boothSelect.appendChild(option);
  });
  setCashFormFeedback("clear");
  refreshTodaysSummary();
}

function setCashFormFeedback(type, message = "") {
  const feedback = document.getElementById("cash-form-feedback");
  if (!feedback) return;
  feedback.className = `cash-form-feedback ${type}`;
  feedback.textContent = message;
  feedback.hidden = !message;
}

function clearCashFieldErrors() {
  document.querySelectorAll(".cash-transaction .input-invalid").forEach((field) => field.classList.remove("input-invalid"));
}

function focusCashField(id, message) {
  const field = document.getElementById(id);
  if (field) {
    field.classList.add("input-invalid");
    field.focus();
  }
  setCashFormFeedback("error", message);
  return false;
}

function validateCashTransaction() {
  clearCashFieldErrors();
  const type = document.getElementById("transaction-type").value;
  const boothCode = document.getElementById("booth").value;
  const amount = Number(document.getElementById("amount").value);
  if (!type) return focusCashField("transaction-type", "Select a transaction type.");
  if (!boothCode) return focusCashField("booth", "Select a booth.");
  if (!selectedServiceForCash) return focusCashField("service", "Select a service.");
  if (!Number.isFinite(amount) || amount <= 0) return focusCashField("amount", "Enter an amount greater than zero.");

  const isPhone = selectedServiceForCash.identifier_type !== "account";
  const phoneNumber = document.getElementById("phone-number").value.trim();
  const accountNumber = document.getElementById("account-number").value.trim();
  if (isPhone && !/^\+?[0-9]{9,15}$/.test(phoneNumber)) return focusCashField("phone-number", "Enter a valid phone number using 9 to 15 digits.");
  if (!isPhone && !/^[A-Za-z0-9-]{5,30}$/.test(accountNumber)) return focusCashField("account-number", "Enter a valid account number.");
  setCashFormFeedback("clear");
  return true;
}

function resetCashServiceSelect() {
  const serviceSelect = document.getElementById("service");
  serviceSelect.innerHTML = '<option value="" selected>Select Service</option>';
  serviceSelect.disabled = true;
  document.getElementById("revenue-rate").textContent = "-";
  document.getElementById("phone-number-group").hidden = true;
  document.getElementById("account-number-group").hidden = true;
  document.getElementById("customer-identifier-hint").hidden = true;
  document.getElementById("customer-identifier-hint").textContent = "";
  selectedServiceForCash = null;
}

export async function handleBoothChange() {
  const code = document.getElementById("booth").value;
  resetCashServiceSelect();
  clearCashFieldErrors();
  if (!code) {
    document.getElementById("booth-location").textContent = "-";
    return;
  }
  setCashFormFeedback("loading", "Loading services for this booth...");
  try {
    const { booth, services } = await api.get(`/api/booths/${encodeURIComponent(code)}/services`);
    document.getElementById("booth-location").textContent = booth.location;
    const serviceSelect = document.getElementById("service");
    serviceSelect.disabled = false;
    services.forEach((service) => {
      const option = document.createElement("option");
      option.value = service.id;
      option.textContent = service.service;
      serviceSelect.appendChild(option);
    });
    setCashFormFeedback("clear");
  } catch (err) {
    setCashFormFeedback("error", err.message || "Unable to load booth services.");
  }
}

export function handleServiceChange() {
  const serviceId = Number(document.getElementById("service").value);
  selectedServiceForCash = state.services.find((service) => service.id === serviceId) || null;
  document.getElementById("revenue-rate").textContent = selectedServiceForCash ? percent(selectedServiceForCash.revenue_rate) : "-";
  const isPhone = !selectedServiceForCash || selectedServiceForCash.identifier_type !== "account";
  document.getElementById("phone-number-group").hidden = !selectedServiceForCash || !isPhone;
  document.getElementById("account-number-group").hidden = !selectedServiceForCash || isPhone;
  const hint = document.getElementById("customer-identifier-hint");
  hint.hidden = !selectedServiceForCash;
  hint.textContent = selectedServiceForCash ? `This service requires the customer's ${isPhone ? "phone number" : "account number"}.` : "";
  clearCashFieldErrors();
  setCashFormFeedback("clear");
  updateCashCalculation();
}

export function updateCashCalculation() {
  const type = document.getElementById("transaction-type").value;
  const amount = Number(document.getElementById("amount").value) || 0;
  const showCalculations = amount > 0;
  const taxPercent = transactionTaxPercent();
  const tax = amount * (taxPercent / 100);
  document.getElementById("transaction-tax-row").hidden = !showCalculations;
  document.getElementById("amount-after-fee-row").hidden = !showCalculations;
  document.getElementById("transaction-tax-label").textContent = `Tax (${taxPercent}%):`;
  document.getElementById("transaction-tax").textContent = showCalculations ? money(tax) : "-";
  document.getElementById("amount-after-fee").textContent = showCalculations ? money(amount - tax) : "-";
}

function populateTransactionConfirmation(transaction) {
  const { payload, boothCode, service, customer } = transaction;
  document.getElementById("confirmation-type").textContent = payload.transaction_type === "deposit" ? "Cash Deposit" : "Cash Withdrawal";
  document.getElementById("confirmation-booth").textContent = boothCode;
  document.getElementById("confirmation-service").textContent = service;
  document.getElementById("confirmation-customer").textContent = customer;
  document.getElementById("confirmation-fee").textContent = money(payload.transaction_tax);
  document.getElementById("confirmation-amount").textContent = money(payload.transaction_amount);
}

function openTransactionConfirmation(transaction) {
  pendingTransaction = transaction;
  populateTransactionConfirmation(transaction);
  openModal(document.getElementById("transaction-confirmation-modal"));
}

export function handleProcessTransaction() {
  if (!canPerform("transactions.create")) {
    setCashFormFeedback("error", "Your role can only view transactions.");
    return;
  }
  const type = document.getElementById("transaction-type").value;
  const boothCode = document.getElementById("booth").value;
  const amount = Number(document.getElementById("amount").value);
  const booth = state.booths.find((entry) => entry.booth === boothCode);
  if (!validateCashTransaction()) return;
  const isPhone = selectedServiceForCash.identifier_type !== "account";
  const phoneNumber = document.getElementById("phone-number").value.trim();
  const accountNumber = document.getElementById("account-number").value.trim();
  const tax = amount * (transactionTaxPercent() / 100);
  const payload = {
    transaction_id: generateTransactionId(),
    transaction_type: type,
    booth_id: booth.id,
    service_id: selectedServiceForCash.id,
    transaction_amount: amount,
    phone_number: isPhone ? phoneNumber : "",
    account_number: isPhone ? "" : accountNumber,
    transaction_tax: tax,
    transaction_amount_after_tax: amount - tax,
    transaction_revenue: amount * Number(selectedServiceForCash.revenue_rate),
    transaction_date: new Date().toISOString(),
  };
  openTransactionConfirmation({
    payload,
    boothCode,
    service: selectedServiceForCash.service,
    customer: isPhone ? phoneNumber : accountNumber,
  });
}

export async function confirmPendingTransaction() {
  if (!canPerform("transactions.create")) {
    pendingTransaction = null;
    closeModal(document.getElementById("transaction-confirmation-modal"));
    setCashFormFeedback("error", "Your role can only view transactions.");
    return;
  }
  if (!pendingTransaction) return;
  const { payload } = pendingTransaction;
  const processButton = document.getElementById("process-transaction");
  const confirmationModal = document.getElementById("transaction-confirmation-modal");
  const confirmButton = document.getElementById("confirm-transaction");
  closeModal(confirmationModal);
  confirmButton.disabled = true;
  processButton.disabled = true;
  processButton.textContent = "Processing...";
  setCashFormFeedback("loading", "Saving transaction...");
  try {
    await api.post("/api/transactions", payload);
    state.transactions = await api.get("/api/transactions");
    resetCashServiceForm();
    refreshTodaysSummary();
    setCashFormFeedback("success", "Transaction processed successfully.");
    showCrudSuccess("Transaction Successful", "The transaction was processed successfully.");
  } catch (err) {
    setCashFormFeedback("error", err.message || "Transaction could not be processed.");
  } finally {
    processButton.disabled = false;
    processButton.textContent = "Process Transaction";
    confirmButton.disabled = false;
    pendingTransaction = null;
  }
}

function resetCashServiceForm({ clearFeedback = true } = {}) {
  document.getElementById("transaction-type").value = "";
  document.getElementById("booth").value = "";
  document.getElementById("booth-location").textContent = "-";
  document.getElementById("amount").value = "";
  document.getElementById("phone-number").value = "";
  document.getElementById("account-number").value = "";
  resetCashServiceSelect();
  updateCashCalculation();
  clearCashFieldErrors();
  if (clearFeedback) setCashFormFeedback("clear");
}

function refreshTodaysSummary() {
  const today = new Date();
  const todaysTransactions = state.transactions.filter((transaction) => isSameDay(transaction.transaction_date, today));
  const deposits = todaysTransactions.filter((transaction) => transaction.transaction_type === "deposit");
  const withdrawals = todaysTransactions.filter((transaction) => transaction.transaction_type === "withdrawal");
  document.getElementById("today-deposit-total").textContent = money(deposits.reduce((sum, transaction) => sum + Number(transaction.transaction_amount), 0));
  document.getElementById("today-deposit-count").textContent = deposits.length;
  document.getElementById("today-withdrawal-total").textContent = money(withdrawals.reduce((sum, transaction) => sum + Number(transaction.transaction_amount), 0));
  document.getElementById("today-withdrawal-count").textContent = withdrawals.length;
  const list = document.getElementById("recent-activity-list");
  list.innerHTML = "";
  if (todaysTransactions.length === 0) {
    list.innerHTML = '<div class="empty-transactions"><span>No transactions today</span></div>';
    return;
  }
  todaysTransactions.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date)).slice(0, 5).forEach((transaction) => {
    const row = document.createElement("div");
    row.className = "transaction-row";
    row.innerHTML = `<div class="transaction-row-details"><div class="transaction-row-heading"><strong class="transaction-reference">${transaction.transaction_id}</strong><span class="activity-type ${transaction.transaction_type}">${transaction.transaction_type === "deposit" ? "Deposit" : "Withdrawal"}</span></div><span class="activity-meta">${transaction.service} · ${formatTime(transaction.transaction_date)}</span></div><strong class="activity-amount ${transaction.transaction_type}">${money(transaction.transaction_amount)}</strong>`;
    list.appendChild(row);
  });
}

export function setupCashServices() {
  document.getElementById("process-transaction").hidden = !canPerform("transactions.create");
  document.getElementById("booth").addEventListener("change", handleBoothChange);
  document.getElementById("service").addEventListener("change", handleServiceChange);
  document.getElementById("transaction-type").addEventListener("change", updateCashCalculation);
  document.getElementById("amount").addEventListener("input", updateCashCalculation);
  document.getElementById("amount").addEventListener("change", updateCashCalculation);
  document.getElementById("process-transaction").addEventListener("click", handleProcessTransaction);
  document.getElementById("confirm-transaction").addEventListener("click", confirmPendingTransaction);
}
