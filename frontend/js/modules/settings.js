import { api } from "./api.js";
import { state } from "./state.js";
import { loadCoreData } from "./data-loader.js";
import { money, percent } from "./formatters.js";
import { setTransactionTaxPercent, transactionTaxPercent } from "./settings-storage.js";
import { closeModal, openCrudConfirmation, openModal, wireModalDismiss } from "./modal.js";
import { canPerform } from "./auth.js";

let editingBoothId = null;
let editingServiceId = null;

export async function renderSettings() {
  try {
    await loadCoreData();
    const entries = await Promise.all(state.booths.map((booth) => api.get(`/api/booths/${encodeURIComponent(booth.booth)}/services`)));
    state.boothServices = {};
    entries.forEach(({ booth, services }) => {
      state.boothServices[booth.booth] = services.map((service) => service.service);
    });
  } catch (err) {
    console.error("Failed to load settings data:", err);
    return;
  }
  renderBoothsTable();
  renderServicesTable();
  const taxInput = document.getElementById("transaction-tax-setting");
  taxInput.value = transactionTaxPercent();
  feeInput.readOnly = !canPerform("settings.write");
  document.querySelector(".settings-save-btn").hidden = !canPerform("settings.write");
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
    const actions = canPerform("settings.write")
      ? '<button type="button" class="user-action-btn edit-booth-btn">Edit</button><button type="button" class="user-action-btn delete delete-booth-btn">Delete</button>'
      : '<span class="settings-read-only">View only</span>';
    row.innerHTML = `<td>${booth.booth}</td><td>${booth.location}</td><td>${services}</td><td>${actions}</td>`;
    if (!canPerform("settings.write")) {
      tbody.appendChild(row);
      return;
    }
    row.querySelector(".edit-booth-btn").addEventListener("click", () => openBoothModal(booth));
    row.querySelector(".delete-booth-btn").addEventListener("click", () => openCrudConfirmation({
      title: "Delete Booth",
      subtitle: "This action cannot be undone.",
      message: `Are you sure you want to delete booth ${booth.booth}?`,
      confirmLabel: "Delete Booth",
      run: async () => { await api.delete(`/api/booths/${booth.id}`); await renderSettings(); },
      successTitle: "Booth Deleted",
      successMessage: `Booth ${booth.booth} was deleted successfully.`,
    }));
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
    const actions = canPerform("settings.write")
      ? '<button type="button" class="user-action-btn edit-service-btn">Edit</button><button type="button" class="user-action-btn delete delete-service-btn">Delete</button>'
      : '<span class="settings-read-only">View only</span>';
    row.innerHTML = `<td>${service.service}</td><td>${money(service.monthly_transaction_limit)}</td><td>${percent(service.revenue_rate)}</td><td>${actions}</td>`;
    if (!canPerform("settings.write")) {
      tbody.appendChild(row);
      return;
    }
    row.querySelector(".edit-service-btn").addEventListener("click", () => openServiceModal(service));
    row.querySelector(".delete-service-btn").addEventListener("click", () => openCrudConfirmation({
      title: "Delete Service",
      subtitle: "This action cannot be undone.",
      message: `Are you sure you want to delete ${service.service}?`,
      confirmLabel: "Delete Service",
      run: async () => { await api.delete(`/api/services/${service.id}`); await renderSettings(); },
      successTitle: "Service Deleted",
      successMessage: `${service.service} was deleted successfully.`,
    }));
    tbody.appendChild(row);
  });
}

function openBoothModal(booth = null) {
  editingBoothId = booth ? booth.id : null;
  const modal = document.getElementById("booth-modal");
  document.getElementById("booth-modal-title").textContent = booth ? "Edit Booth" : "Add Booth";
  document.getElementById("save-booth").textContent = booth ? "Update Booth" : "Save Booth";
  document.getElementById("booth-code").value = booth?.booth || "";
  document.getElementById("booth-location-setting").value = booth?.location || "";
  modal.querySelectorAll('input[name="booth-services"]').forEach((checkbox) => {
    checkbox.checked = !!booth && (state.boothServices[booth.booth] || []).includes(checkbox.value);
  });
  openModal(modal);
}

function openServiceModal(service = null) {
  editingServiceId = service ? service.id : null;
  document.getElementById("service-modal-title").textContent = service ? "Edit Service" : "Add Service";
  document.getElementById("save-service").textContent = service ? "Update Service" : "Save Service";
  document.getElementById("service-name").value = service?.service || "";
  document.getElementById("service-monthly-limit").value = service?.monthly_transaction_limit || "";
  document.getElementById("service-revenue-rate").value = service ? Number(service.revenue_rate) * 100 : "";
  document.getElementById("service-identifier-type").value = service?.identifier_type || "";
  openModal(document.getElementById("service-modal"));
}

export function setupSettingsModals() {
  const boothModal = document.getElementById("booth-modal");
  const serviceModal = document.getElementById("service-modal");
  wireModalDismiss(boothModal);
  wireModalDismiss(serviceModal);
  const canWrite = canPerform("settings.write");
  document.getElementById("add-booth-btn").hidden = !canWrite;
  document.getElementById("add-service-btn").hidden = !canWrite;
  document.querySelector(".settings-save-btn").hidden = !canWrite;
  document.getElementById("transaction-tax-setting").readOnly = !canWrite;
  if (!canWrite) return;

  document.getElementById("add-booth-btn").addEventListener("click", () => openBoothModal());
  document.getElementById("save-booth").addEventListener("click", () => {
    const boothCode = document.getElementById("booth-code").value.trim();
    const location = document.getElementById("booth-location-setting").value.trim();
    const services = Array.from(boothModal.querySelectorAll('input[name="booth-services"]:checked')).map((checkbox) => checkbox.value);
    if (!boothCode || !location) { alert("Please enter a booth name and location."); return; }
    const boothId = editingBoothId;
    const isEditing = Boolean(boothId);
    openCrudConfirmation({
      title: isEditing ? "Update Booth" : "Save Booth",
      subtitle: "Confirm the booth details.",
      message: `${isEditing ? "Update" : "Create"} booth ${boothCode} at ${location}?`,
      confirmLabel: isEditing ? "Update Booth" : "Save Booth",
      run: async () => {
        if (isEditing) await api.put(`/api/booths/${boothId}`, { booth: boothCode, location, services });
        else await api.post("/api/booths", { booth: boothCode, location, services });
        closeModal(boothModal);
        editingBoothId = null;
        await renderSettings();
      },
      successTitle: isEditing ? "Booth Updated" : "Booth Saved",
      successMessage: `Booth ${boothCode} was ${isEditing ? "updated" : "saved"} successfully.`,
    });
  });
  document.getElementById("add-service-btn").addEventListener("click", () => openServiceModal());
  document.getElementById("save-service").addEventListener("click", () => {
    const service = document.getElementById("service-name").value.trim();
    const monthlyLimit = Number(document.getElementById("service-monthly-limit").value);
    const revenueRatePercent = Number(document.getElementById("service-revenue-rate").value);
    const identifierType = document.getElementById("service-identifier-type").value;
    if (!service || !monthlyLimit || !revenueRatePercent || !identifierType) { alert("Please fill in every field."); return; }
    const serviceId = editingServiceId;
    const isEditing = Boolean(serviceId);
    openCrudConfirmation({
      title: isEditing ? "Update Service" : "Save Service",
      subtitle: "Confirm the service details.",
      message: `${isEditing ? "Update" : "Create"} service ${service}?`,
      confirmLabel: isEditing ? "Update Service" : "Save Service",
      run: async () => {
        const payload = { service, monthly_transaction_limit: monthlyLimit, revenue_rate: revenueRatePercent / 100, identifier_type: identifierType };
        if (isEditing) await api.put(`/api/services/${serviceId}`, payload);
        else await api.post("/api/services", payload);
        closeModal(serviceModal);
        editingServiceId = null;
        await renderSettings();
      },
      successTitle: isEditing ? "Service Updated" : "Service Saved",
      successMessage: `${service} was ${isEditing ? "updated" : "saved"} successfully.`,
    });
  });
  document.querySelector(".settings-save-btn").addEventListener("click", () => {
    const value = Number(document.getElementById("transaction-tax-setting").value);
    openCrudConfirmation({
      title: "Save Settings",
      subtitle: "Confirm the transaction tax setting.",
      message: `Save the transaction tax as ${value}%?`,
      confirmLabel: "Save Settings",
      run: async () => setTransactionTaxPercent(value),
      successTitle: "Settings Saved",
      successMessage: "The transaction tax setting was saved successfully.",
    });
  });
}
