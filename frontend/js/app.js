// Wina Bwangu frontend logic.
// Talks to the Express API under /api/* and renders all five pages.
// No frameworks / build step — plain DOM + fetch, matching the rest of the project.

// ---------------------------------------------------------------------------
// Small API helper: wraps fetch, parses JSON, and turns a non-2xx response
// into a thrown Error whose message is the server's { error } message.
// ---------------------------------------------------------------------------
const api = {
  async request(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  },
  get(path) {
    return this.request("GET", path);
  },
  post(path, body) {
    return this.request("POST", path, body);
  },
  put(path, body) {
    return this.request("PUT", path, body);
  },
  delete(path) {
    return this.request("DELETE", path);
  },
};

// In-memory cache of everything the app needs. Re-fetched whenever a page is
// opened so the dataset (small, a handful of rows) is always current.
const state = {
  booths: [],
  services: [],
  transactions: [],
  users: [],
  boothServices: {}, // { boothCode: [serviceName, ...] } — used on the Settings page
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function money(amount) {
  const n = Number(amount) || 0;
  return "K " + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function percent(rate) {
  return (Number(rate) * 100).toFixed(2) + "%";
}

function formatDateTime(isoString) {
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleString();
}

function isSameDay(isoString, date) {
  const d = new Date(isoString);
  return (
    d.getFullYear() === date.getFullYear() &&
    d.getMonth() === date.getMonth() &&
    d.getDate() === date.getDate()
  );
}

function generateTransactionId() {
  return `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function withdrawalFeePercent() {
  const stored = localStorage.getItem("wb_withdrawal_fee_percent");
  return stored ? Number(stored) : 1.5;
}

// ---------------------------------------------------------------------------
// Modal helpers (used by the receipt modal and the three settings modals)
// ---------------------------------------------------------------------------
function openModal(modal) {
  modal.hidden = false;
}
function closeModal(modal) {
  modal.hidden = true;
}
function wireModalDismiss(modal) {
  modal
    .querySelectorAll(
      ".settings-modal-close, .settings-modal-cancel, .settings-modal-backdrop, .receipt-close-btn, .receipt-done-btn, .receipt-modal-backdrop",
    )
    .forEach((el) => {
      el.addEventListener("click", () => closeModal(modal));
    });
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
const pageLoaders = {
  dashboard: renderDashboard,
  "cash-services": renderCashServices,
  transactions: renderTransactions,
  settings: renderSettings,
  users: renderUsers,
};

function showPage(pageId) {
  document.querySelectorAll(".page-content").forEach((el) => {
    el.classList.toggle("active", el.id === pageId);
  });
  document.querySelectorAll("nav a[data-page]").forEach((el) => {
    el.classList.toggle("active", el.dataset.page === pageId);
  });
  const loader = pageLoaders[pageId];
  if (loader) loader();
}

function setupNavigation() {
  document.querySelectorAll("nav a[data-page]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showPage(link.dataset.page);
    });
  });
}

// ---------------------------------------------------------------------------
// Shared data loading
// ---------------------------------------------------------------------------
async function loadCoreData() {
  const [booths, services, transactions, users] = await Promise.all([
    api.get("/api/booths"),
    api.get("/api/services"),
    api.get("/api/transactions"),
    api.get("/api/users"),
  ]);
  state.booths = booths;
  state.services = services;
  state.transactions = transactions;
  state.users = users;
}

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------
async function renderDashboard() {
  try {
    await loadCoreData();
  } catch (err) {
    console.error("Failed to load dashboard data:", err);
    return;
  }

  const totalRevenue = state.transactions.reduce((sum, t) => sum + Number(t.transaction_revenue), 0);
  document.getElementById("dash-total-revenue").textContent = money(totalRevenue);
  document.getElementById("dash-total-transactions").textContent = state.transactions.length;
  document.getElementById("dash-active-booths").textContent = state.booths.length;

  // Per-service breakdown: count, revenue and credit (of the monthly limit) used.
  const perService = state.services.map((service) => {
    const rows = state.transactions.filter((t) => t.service_id === service.id);
    const totalAmount = rows.reduce((sum, t) => sum + Number(t.transaction_amount), 0);
    const revenue = rows.reduce((sum, t) => sum + Number(t.transaction_revenue), 0);
    const utilisation = service.monthly_transaction_limit > 0 ? totalAmount / service.monthly_transaction_limit : 0;
    return { service, count: rows.length, totalAmount, revenue, utilisation };
  });

  const overallUtilisation =
    perService.length > 0 ? perService.reduce((sum, s) => sum + s.utilisation, 0) / perService.length : 0;
  document.getElementById("dash-credit-utilised").textContent = (overallUtilisation * 100).toFixed(1) + "%";

  // Service performance table
  const tbody = document.getElementById("dashboard-service-tbody");
  tbody.innerHTML = "";
  if (perService.length === 0) {
    tbody.innerHTML = '<tr class="empty-table-row"><td colspan="6">No services found</td></tr>';
  } else {
    perService.forEach(({ service, count, totalAmount, revenue, utilisation }) => {
      const remaining = Math.max(service.monthly_transaction_limit - totalAmount, 0);
      const statusClass = utilisation >= 1 ? "exceeded" : utilisation >= 0.8 ? "warning" : "good";
      const statusText = utilisation >= 1 ? "Exceeded" : utilisation >= 0.8 ? "Near Limit" : "Good";
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${service.service}</td>
        <td>${count}</td>
        <td>${money(revenue)}</td>
        <td>${money(totalAmount)}</td>
        <td>${money(remaining)}</td>
        <td><span class="service-status ${statusClass}">${statusText}</span></td>
      `;
      tbody.appendChild(row);
    });
  }

  renderSimpleBarChart(
    "revenue-by-service-chart",
    perService.map((s) => ({ label: s.service.service, value: s.revenue })),
    money,
  );
  renderSimpleBarChart(
    "credit-utilization-chart",
    perService.map((s) => ({ label: s.service.service, value: s.utilisation * 100 })),
    (v) => v.toFixed(1) + "%",
  );
}

// A dependency-free "chart": horizontal bars sized relative to the largest value.
function renderSimpleBarChart(containerId, rows, formatValue) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  const max = Math.max(1, ...rows.map((r) => r.value));
  rows.forEach(({ label, value }) => {
    const widthPercent = Math.min(100, (value / max) * 100);
    const row = document.createElement("div");
    row.className = "simple-bar-row";
    row.innerHTML = `
      <span>${label}</span>
      <span class="simple-bar-track"><span class="simple-bar-fill" style="width:${widthPercent}%"></span></span>
      <span>${formatValue(value)}</span>
    `;
    container.appendChild(row);
  });
}

// ---------------------------------------------------------------------------
// Cash Services page
// ---------------------------------------------------------------------------
async function renderCashServices() {
  try {
    if (state.booths.length === 0) await loadCoreData();
  } catch (err) {
    console.error("Failed to load cash services data:", err);
    return;
  }

  const boothSelect = document.getElementById("booth");
  boothSelect.innerHTML = '<option value="" selected disabled>Select Booth</option>';
  state.booths.forEach((booth) => {
    const opt = document.createElement("option");
    opt.value = booth.booth;
    opt.textContent = `${booth.booth} — ${booth.location}`;
    boothSelect.appendChild(opt);
  });

  refreshTodaysSummary();
}

let selectedServiceForCash = null; // caches the currently chosen service's rate/identifier type

function resetCashServiceSelect() {
  const serviceSelect = document.getElementById("service");
  serviceSelect.innerHTML = '<option value="" selected>Select Service</option>';
  serviceSelect.disabled = true;
  document.getElementById("revenue-rate").textContent = "-";
  document.getElementById("phone-number-group").hidden = true;
  document.getElementById("account-number-group").hidden = true;
  selectedServiceForCash = null;
}

async function handleBoothChange() {
  const boothSelect = document.getElementById("booth");
  const code = boothSelect.value;
  resetCashServiceSelect();
  if (!code) {
    document.getElementById("booth-location").textContent = "-";
    return;
  }

  try {
    const { booth, services } = await api.get(`/api/booths/${encodeURIComponent(code)}/services`);
    document.getElementById("booth-location").textContent = booth.location;

    const serviceSelect = document.getElementById("service");
    serviceSelect.disabled = false;
    services.forEach((service) => {
      const opt = document.createElement("option");
      opt.value = service.id;
      opt.textContent = service.service;
      serviceSelect.appendChild(opt);
    });
  } catch (err) {
    alert(err.message);
  }
}

function handleServiceChange() {
  const serviceSelect = document.getElementById("service");
  const serviceId = Number(serviceSelect.value);
  selectedServiceForCash = state.services.find((s) => s.id === serviceId) || null;

  document.getElementById("revenue-rate").textContent = selectedServiceForCash
    ? percent(selectedServiceForCash.revenue_rate)
    : "-";

  const isPhone = !selectedServiceForCash || selectedServiceForCash.identifier_type !== "account";
  document.getElementById("phone-number-group").hidden = !selectedServiceForCash || !isPhone;
  document.getElementById("account-number-group").hidden = !selectedServiceForCash || isPhone;

  updateCashCalculation();
}

function updateCashCalculation() {
  const type = document.getElementById("transaction-type").value;
  const amount = Number(document.getElementById("amount").value) || 0;
  const isWithdrawal = type === "withdrawal";

  document.getElementById("withdrawal-fee-row").hidden = !isWithdrawal;
  document.getElementById("amount-after-fee-row").hidden = !isWithdrawal;

  if (isWithdrawal) {
    const fee = amount * (withdrawalFeePercent() / 100);
    document.getElementById("withdrawal-fee").textContent = money(fee);
    document.getElementById("amount-after-fee").textContent = money(amount - fee);
  }
}

async function handleProcessTransaction() {
  const type = document.getElementById("transaction-type").value;
  const boothCode = document.getElementById("booth").value;
  const amount = Number(document.getElementById("amount").value);
  const booth = state.booths.find((b) => b.booth === boothCode);

  if (!type || !boothCode || !selectedServiceForCash || !amount || amount <= 0) {
    alert("Please fill in transaction type, booth, service and a valid amount.");
    return;
  }

  const isPhone = selectedServiceForCash.identifier_type !== "account";
  const phoneNumber = document.getElementById("phone-number").value.trim();
  const accountNumber = document.getElementById("account-number").value.trim();
  if (isPhone && !phoneNumber) {
    alert("Please enter the customer's phone number.");
    return;
  }
  if (!isPhone && !accountNumber) {
    alert("Please enter the customer's account number.");
    return;
  }

  const isWithdrawal = type === "withdrawal";
  const fee = isWithdrawal ? amount * (withdrawalFeePercent() / 100) : 0;
  const amountAfterFee = amount - fee;
  const revenue = amount * Number(selectedServiceForCash.revenue_rate);
  const transactionDate = new Date().toISOString();
  const transactionId = generateTransactionId();

  const payload = {
    transaction_id: transactionId,
    transaction_type: type,
    booth_id: booth.id,
    service_id: selectedServiceForCash.id,
    transaction_amount: amount,
    phone_number: isPhone ? phoneNumber : "",
    account_number: isPhone ? "" : accountNumber,
    // The schema's "tax" columns are reused here to store the withdrawal fee,
    // since deposits and withdrawals are the only two transaction types and
    // there is no separate tax concept in this project.
    transaction_tax: fee,
    transaction_amount_after_tax: amountAfterFee,
    transaction_revenue: revenue,
    transaction_date: transactionDate,
  };

  try {
    await api.post("/api/transactions", payload);
    state.transactions = await api.get("/api/transactions");
    showReceipt({ ...payload, booth: boothCode, location: booth.location, service: selectedServiceForCash.service });
    resetCashServiceForm();
    refreshTodaysSummary();
  } catch (err) {
    alert(err.message);
  }
}

function resetCashServiceForm() {
  document.getElementById("transaction-type").value = "";
  document.getElementById("booth").value = "";
  document.getElementById("booth-location").textContent = "-";
  document.getElementById("amount").value = "";
  document.getElementById("phone-number").value = "";
  document.getElementById("account-number").value = "";
  resetCashServiceSelect();
  updateCashCalculation();
}

function refreshTodaysSummary() {
  const today = new Date();
  const todaysTransactions = state.transactions.filter((t) => isSameDay(t.transaction_date, today));
  const deposits = todaysTransactions.filter((t) => t.transaction_type === "deposit");
  const withdrawals = todaysTransactions.filter((t) => t.transaction_type === "withdrawal");

  document.getElementById("today-deposit-total").textContent = money(
    deposits.reduce((sum, t) => sum + Number(t.transaction_amount), 0),
  );
  document.getElementById("today-deposit-count").textContent = deposits.length;
  document.getElementById("today-withdrawal-total").textContent = money(
    withdrawals.reduce((sum, t) => sum + Number(t.transaction_amount), 0),
  );
  document.getElementById("today-withdrawal-count").textContent = withdrawals.length;

  const list = document.getElementById("recent-activity-list");
  list.innerHTML = "";
  if (todaysTransactions.length === 0) {
    list.innerHTML = '<div class="empty-transactions"><span>No transactions today</span></div>';
    return;
  }
  todaysTransactions.slice(0, 5).forEach((t) => {
    const row = document.createElement("div");
    row.className = "transaction-row";
    row.textContent = `${t.transaction_type === "deposit" ? "Deposit" : "Withdrawal"} · ${t.service} · ${money(t.transaction_amount)} · ${t.booth}`;
    list.appendChild(row);
  });
}

// ---------------------------------------------------------------------------
// Receipt modal (used by both Cash Services and the Transactions history)
// ---------------------------------------------------------------------------
function showReceipt(t) {
  document.getElementById("receipt-transaction-id").textContent = t.transaction_id;
  document.getElementById("receipt-type").textContent = t.transaction_type === "deposit" ? "Cash Deposit" : "Cash Withdrawal";
  document.getElementById("receipt-date").textContent = formatDateTime(t.transaction_date);
  document.getElementById("receipt-booth").textContent = t.booth;
  document.getElementById("receipt-location").textContent = t.location;
  document.getElementById("receipt-service").textContent = t.service;

  const isPhone = !!t.phone_number;
  document.getElementById("receipt-phone-row").hidden = !isPhone;
  document.getElementById("receipt-phone").textContent = t.phone_number || "-";
  document.getElementById("receipt-account-row").hidden = isPhone;
  document.getElementById("receipt-account").textContent = t.account_number || "-";

  const service = state.services.find((s) => s.service === t.service);
  document.getElementById("receipt-revenue-rate").textContent = service ? percent(service.revenue_rate) : "-";

  const isWithdrawal = t.transaction_type === "withdrawal";
  document.getElementById("receipt-fee-row").hidden = !isWithdrawal;
  document.getElementById("receipt-amount-after-fee-row").hidden = !isWithdrawal;
  document.getElementById("receipt-fee").textContent = money(t.transaction_tax);
  document.getElementById("receipt-amount-after-fee").textContent = money(t.transaction_amount_after_tax);
  document.getElementById("receipt-amount").textContent = money(t.transaction_amount);

  openModal(document.getElementById("receipt-modal"));
}

// ---------------------------------------------------------------------------
// Transactions page
// ---------------------------------------------------------------------------
async function renderTransactions() {
  try {
    await loadCoreData();
  } catch (err) {
    console.error("Failed to load transactions:", err);
    return;
  }

  const boothFilter = document.getElementById("booth-filter");
  boothFilter.innerHTML = '<option value="">All Booths</option>';
  state.booths.forEach((b) => {
    boothFilter.innerHTML += `<option value="${b.booth}">${b.booth}</option>`;
  });

  const serviceFilter = document.getElementById("service-filter");
  serviceFilter.innerHTML = '<option value="">All Services</option>';
  state.services.forEach((s) => {
    serviceFilter.innerHTML += `<option value="${s.service}">${s.service}</option>`;
  });

  applyTransactionFilters();
}

function applyTransactionFilters() {
  const search = document.getElementById("transaction-search").value.trim().toLowerCase();
  const type = document.getElementById("transaction-type-filter").value;
  const booth = document.getElementById("booth-filter").value;
  const service = document.getElementById("service-filter").value;
  const start = document.getElementById("start-date-filter").value;
  const end = document.getElementById("end-date-filter").value;

  const filtered = state.transactions.filter((t) => {
    if (type && t.transaction_type !== type) return false;
    if (booth && t.booth !== booth) return false;
    if (service && t.service !== service) return false;
    if (search) {
      const haystack = `${t.transaction_id} ${t.phone_number} ${t.account_number}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    const day = t.transaction_date.slice(0, 10);
    if (start && day < start) return false;
    if (end && day > end) return false;
    return true;
  });

  renderTransactionsTable(filtered);
  renderTransactionsOverview(filtered);
}

function renderTransactionsTable(rows) {
  const tbody = document.getElementById("transactions-tbody");
  tbody.innerHTML = "";
  if (rows.length === 0) {
    tbody.innerHTML = '<tr class="empty-table-row"><td colspan="8">No transactions found</td></tr>';
    return;
  }
  rows.forEach((t) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${t.transaction_id}</td>
      <td>${t.transaction_type === "deposit" ? "Deposit" : "Withdrawal"}</td>
      <td>${formatDateTime(t.transaction_date)}</td>
      <td>${t.booth}</td>
      <td>${t.location}</td>
      <td>${t.service}</td>
      <td>${money(t.transaction_amount)}</td>
      <td><button type="button" class="user-action-btn view-transaction-btn">View</button></td>
    `;
    row.querySelector(".view-transaction-btn").addEventListener("click", () => showReceipt(t));
    tbody.appendChild(row);
  });
}

function renderTransactionsOverview(rows) {
  const deposits = rows.filter((t) => t.transaction_type === "deposit");
  const withdrawals = rows.filter((t) => t.transaction_type === "withdrawal");
  document.getElementById("overview-total-count").textContent = rows.length;
  document.getElementById("overview-total-deposits").textContent = money(
    deposits.reduce((sum, t) => sum + Number(t.transaction_amount), 0),
  );
  document.getElementById("overview-total-withdrawals").textContent = money(
    withdrawals.reduce((sum, t) => sum + Number(t.transaction_amount), 0),
  );
  document.getElementById("overview-total-revenue").textContent = money(
    rows.reduce((sum, t) => sum + Number(t.transaction_revenue), 0),
  );
}

function exportTransactionsCsv() {
  const rows = state.transactions;
  const header = ["Transaction ID", "Type", "Date", "Booth", "Location", "Service", "Amount", "Revenue"];
  const lines = [header.join(",")];
  rows.forEach((t) => {
    lines.push(
      [t.transaction_id, t.transaction_type, t.transaction_date, t.booth, t.location, t.service, t.transaction_amount, t.transaction_revenue]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "wina-bwangu-transactions.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Settings page (booths + services management)
// ---------------------------------------------------------------------------
async function renderSettings() {
  try {
    await loadCoreData();
    const entries = await Promise.all(
      state.booths.map((b) => api.get(`/api/booths/${encodeURIComponent(b.booth)}/services`)),
    );
    state.boothServices = {};
    entries.forEach(({ booth, services }) => {
      state.boothServices[booth.booth] = services.map((s) => s.service);
    });
  } catch (err) {
    console.error("Failed to load settings data:", err);
    return;
  }

  renderBoothsTable();
  renderServicesTable();

  const feeInput = document.getElementById("withdrawal-fee-setting");
  feeInput.value = withdrawalFeePercent();
}

function renderBoothsTable() {
  const tbody = document.getElementById("settings-booths-tbody");
  tbody.innerHTML = "";
  if (state.booths.length === 0) {
    tbody.innerHTML = '<tr class="empty-table-row"><td colspan="4">No booths found</td></tr>';
    return;
  }
  state.booths.forEach((booth) => {
    const services = (state.boothServices[booth.booth] || []).join(", ") || "-";
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${booth.booth}</td>
      <td>${booth.location}</td>
      <td>${services}</td>
      <td><button type="button" class="user-action-btn delete delete-booth-btn">Delete</button></td>
    `;
    row.querySelector(".delete-booth-btn").addEventListener("click", async () => {
      if (!confirm(`Delete booth ${booth.booth}?`)) return;
      try {
        await api.delete(`/api/booths/${booth.id}`);
        await renderSettings();
      } catch (err) {
        alert(err.message);
      }
    });
    tbody.appendChild(row);
  });
}

function renderServicesTable() {
  const tbody = document.getElementById("settings-services-tbody");
  tbody.innerHTML = "";
  if (state.services.length === 0) {
    tbody.innerHTML = '<tr class="empty-table-row"><td colspan="4">No services found</td></tr>';
    return;
  }
  state.services.forEach((service) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${service.service}</td>
      <td>${money(service.monthly_transaction_limit)}</td>
      <td>${percent(service.revenue_rate)}</td>
      <td><button type="button" class="user-action-btn delete delete-service-btn">Delete</button></td>
    `;
    row.querySelector(".delete-service-btn").addEventListener("click", async () => {
      if (!confirm(`Delete service ${service.service}?`)) return;
      try {
        await api.delete(`/api/services/${service.id}`);
        await renderSettings();
      } catch (err) {
        alert(err.message);
      }
    });
    tbody.appendChild(row);
  });
}

function setupSettingsModals() {
  const boothModal = document.getElementById("booth-modal");
  const serviceModal = document.getElementById("service-modal");
  wireModalDismiss(boothModal);
  wireModalDismiss(serviceModal);

  document.getElementById("add-booth-btn").addEventListener("click", () => {
    document.getElementById("booth-code").value = "";
    document.getElementById("booth-location-setting").value = "";
    boothModal.querySelectorAll('input[name="booth-services"]').forEach((cb) => (cb.checked = false));
    openModal(boothModal);
  });

  document.getElementById("save-booth").addEventListener("click", async () => {
    const boothCode = document.getElementById("booth-code").value.trim();
    const location = document.getElementById("booth-location-setting").value.trim();
    const services = Array.from(boothModal.querySelectorAll('input[name="booth-services"]:checked')).map(
      (cb) => cb.value,
    );
    if (!boothCode || !location) {
      alert("Please enter a booth name and location.");
      return;
    }
    try {
      await api.post("/api/booths", { booth: boothCode, location, services });
      closeModal(boothModal);
      await renderSettings();
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById("add-service-btn").addEventListener("click", () => {
    document.getElementById("service-name").value = "";
    document.getElementById("service-monthly-limit").value = "";
    document.getElementById("service-revenue-rate").value = "";
    document.getElementById("service-identifier-type").value = "";
    openModal(serviceModal);
  });

  document.getElementById("save-service").addEventListener("click", async () => {
    const service = document.getElementById("service-name").value.trim();
    const monthlyLimit = Number(document.getElementById("service-monthly-limit").value);
    const revenueRatePercent = Number(document.getElementById("service-revenue-rate").value);
    const identifierType = document.getElementById("service-identifier-type").value;
    if (!service || !monthlyLimit || !revenueRatePercent || !identifierType) {
      alert("Please fill in every field.");
      return;
    }
    try {
      await api.post("/api/services", {
        service,
        monthly_transaction_limit: monthlyLimit,
        revenue_rate: revenueRatePercent / 100, // input is entered as a percentage, e.g. "5" -> 0.05
        identifier_type: identifierType,
      });
      closeModal(serviceModal);
      await renderSettings();
    } catch (err) {
      alert(err.message);
    }
  });

  document.querySelector(".settings-save-btn").addEventListener("click", () => {
    const value = Number(document.getElementById("withdrawal-fee-setting").value) || 1.5;
    localStorage.setItem("wb_withdrawal_fee_percent", String(value));
    alert("Settings saved.");
  });
}

// ---------------------------------------------------------------------------
// Users page
// ---------------------------------------------------------------------------
const roleLabels = {
  system_admin: "System Administrator",
  admin_agent: "Admin Agent",
  agent: "Agent",
};

let editingUserId = null;

async function renderUsers() {
  try {
    await loadCoreData();
  } catch (err) {
    console.error("Failed to load users:", err);
    return;
  }
  applyUserFilters();
}

function applyUserFilters() {
  const role = document.getElementById("user-role-filter").value;
  const status = document.getElementById("user-status-filter").value;
  const filtered = state.users.filter((u) => {
    if (role !== "all" && u.role !== role) return false;
    if (status !== "all" && u.status !== status) return false;
    return true;
  });
  renderUsersTable(filtered);
  renderUsersOverview();
}

function renderUsersOverview() {
  document.getElementById("users-count-system-admin").textContent = state.users.filter(
    (u) => u.role === "system_admin",
  ).length;
  document.getElementById("users-count-admin-agent").textContent = state.users.filter(
    (u) => u.role === "admin_agent",
  ).length;
  document.getElementById("users-count-agent").textContent = state.users.filter((u) => u.role === "agent").length;
  document.getElementById("users-count-total").textContent = state.users.length;
}

function renderUsersTable(rows) {
  const tbody = document.getElementById("users-tbody");
  tbody.innerHTML = "";
  if (rows.length === 0) {
    tbody.innerHTML = '<tr class="empty-table-row"><td colspan="10">No users found</td></tr>';
    return;
  }
  rows.forEach((user) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${user.full_name}</td>
      <td>${user.username}</td>
      <td>${user.email}</td>
      <td>${roleLabels[user.role] || user.role}</td>
      <td>${user.company || "N/A"}</td>
      <td>${user.assigned_booths.join(", ") || "N/A"}</td>
      <td>${user.assigned_services.join(", ") || "N/A"}</td>
      <td>${user.last_login ? formatDateTime(user.last_login) : "Never"}</td>
      <td><span class="user-status ${user.status}">${user.status === "active" ? "Active" : "Inactive"}</span></td>
      <td class="user-actions">
        <button type="button" class="user-action-btn edit-user-btn">Edit</button>
        <button type="button" class="user-action-btn delete delete-user-btn">Delete</button>
      </td>
    `;
    row.querySelector(".edit-user-btn").addEventListener("click", () => openUserModal(user));
    row.querySelector(".delete-user-btn").addEventListener("click", async () => {
      if (!confirm(`Delete user ${user.username}?`)) return;
      try {
        await api.delete(`/api/users/${user.id}`);
        await renderUsers();
      } catch (err) {
        alert(err.message);
      }
    });
    tbody.appendChild(row);
  });
}

function openUserModal(user) {
  editingUserId = user ? user.id : null;
  const modal = document.getElementById("user-modal");
  document.getElementById("user-modal-title").textContent = user ? "Edit User" : "Add New User";

  document.getElementById("user-username").value = user?.username || "";
  document.getElementById("user-full-name").value = user?.full_name || "";
  document.getElementById("user-email").value = user?.email || "";
  document.getElementById("user-password").value = "";
  document.getElementById("user-confirm-password").value = "";
  document.getElementById("user-role").value = user?.role || "";
  document.getElementById("user-status").value = user?.status || "active";
  document.getElementById("user-company").value =
    user?.company === "Wina Bwangu" ? "wina_bwangu" : user?.company ? "other" : "";

  modal.querySelectorAll('input[name="user-booths"]').forEach((cb) => {
    cb.checked = !!user?.assigned_booths.includes(cb.value);
  });
  modal.querySelectorAll('input[name="user-services"]').forEach((cb) => {
    cb.checked = !!user?.assigned_services.includes(cb.value);
  });
  modal.querySelectorAll(".user-checkbox-grid").forEach((grid) => {
    const hint = grid.nextElementSibling;
    if (hint && hint.classList.contains("assignment-empty")) {
      hint.hidden = !!grid.querySelector("input:checked");
    }
  });

  openModal(modal);
}

function setupUsersModal() {
  const modal = document.getElementById("user-modal");
  wireModalDismiss(modal);

  document.getElementById("add-user-btn").addEventListener("click", () => openUserModal(null));

  // Toggle each "No X assigned" hint as its checkbox group changes.
  modal.querySelectorAll(".user-checkbox-grid").forEach((grid) => {
    grid.addEventListener("change", () => {
      const hint = grid.nextElementSibling;
      if (hint && hint.classList.contains("assignment-empty")) {
        hint.hidden = !!grid.querySelector("input:checked");
      }
    });
  });

  document.getElementById("save-user").addEventListener("click", async () => {
    const username = document.getElementById("user-username").value.trim();
    const fullName = document.getElementById("user-full-name").value.trim();
    const email = document.getElementById("user-email").value.trim();
    const password = document.getElementById("user-password").value;
    const confirmPassword = document.getElementById("user-confirm-password").value;
    const role = document.getElementById("user-role").value;
    const status = document.getElementById("user-status").value;
    const companyChoice = document.getElementById("user-company").value;
    const company = companyChoice === "wina_bwangu" ? "Wina Bwangu" : companyChoice === "other" ? "Other" : null;
    const assignedBooths = Array.from(modal.querySelectorAll('input[name="user-booths"]:checked')).map(
      (cb) => cb.value,
    );
    const assignedServices = Array.from(modal.querySelectorAll('input[name="user-services"]:checked')).map(
      (cb) => cb.value,
    );

    if (!username || !fullName || !email || !role || !companyChoice) {
      alert("Please fill in every required field.");
      return;
    }
    if (!editingUserId && !password) {
      alert("Please set a password for the new user.");
      return;
    }
    if (password && password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }

    const payload = {
      username,
      full_name: fullName,
      email,
      role,
      status,
      company,
      assigned_booths: assignedBooths,
      assigned_services: assignedServices,
    };
    if (password) payload.password = password;

    try {
      if (editingUserId) {
        await api.put(`/api/users/${editingUserId}`, payload);
      } else {
        await api.post("/api/users", payload);
      }
      closeModal(modal);
      await renderUsers();
    } catch (err) {
      alert(err.message);
    }
  });
}

// ---------------------------------------------------------------------------
// Wire everything up once the DOM is ready
// ---------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupSettingsModals();
  setupUsersModal();
  wireModalDismiss(document.getElementById("receipt-modal"));

  document.getElementById("booth").addEventListener("change", handleBoothChange);
  document.getElementById("service").addEventListener("change", handleServiceChange);
  document.getElementById("transaction-type").addEventListener("change", updateCashCalculation);
  document.getElementById("amount").addEventListener("input", updateCashCalculation);
  document.getElementById("process-transaction").addEventListener("click", handleProcessTransaction);

  [
    "transaction-search",
    "transaction-type-filter",
    "booth-filter",
    "service-filter",
    "start-date-filter",
    "end-date-filter",
  ].forEach((id) => {
    document.getElementById(id).addEventListener("input", applyTransactionFilters);
    document.getElementById(id).addEventListener("change", applyTransactionFilters);
  });
  document.getElementById("print-transactions").addEventListener("click", () => window.print());
  document.getElementById("export-transactions").addEventListener("click", exportTransactionsCsv);

  document.getElementById("user-role-filter").addEventListener("change", applyUserFilters);
  document.getElementById("user-status-filter").addEventListener("change", applyUserFilters);

  showPage("dashboard");
});
