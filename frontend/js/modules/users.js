import { api } from "./api.js";
import { state } from "./state.js";
import { loadCoreData } from "./data-loader.js";
import { formatDateTime } from "./formatters.js";
import { roleLabels } from "./roles.js";
import {
  closeModal,
  openCrudConfirmation,
  openModal,
  wireModalDismiss,
} from "./modal.js";
import { canPerform } from "./auth.js";

let editingUserId = null;

export async function renderUsers() {
  if (!canPerform("users.manage")) return;
  try {
    await loadCoreData();
  } catch (err) {
    console.error("Failed to load users:", err);
    return;
  }
  applyUserFilters();
}

export function applyUserFilters() {
  const role = document.getElementById("user-role-filter").value;
  const status = document.getElementById("user-status-filter").value;
  const filtered = state.users.filter(
    (user) =>
      (role === "all" || user.role === role) &&
      (status === "all" || user.status === status),
  );
  renderUsersTable(filtered);
  renderUsersOverview();
}

function renderUsersOverview() {
  document.getElementById("users-count-system-admin").textContent =
    state.users.filter((user) => user.role === "system_admin").length;
  document.getElementById("users-count-admin-agent").textContent =
    state.users.filter((user) => user.role === "admin_agent").length;
  document.getElementById("users-count-agent").textContent = state.users.filter(
    (user) => user.role === "agent",
  ).length;
  document.getElementById("users-count-total").textContent = state.users.length;
}

function renderUsersTable(rows) {
  const tbody = document.getElementById("users-tbody");
  tbody.innerHTML = "";
  if (rows.length === 0) {
    tbody.innerHTML =
      '<tr class="empty-table-row"><td colspan="10">No users found</td></tr>';
    return;
  }
  rows.forEach((user) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${user.full_name}</td><td>${user.username}</td><td>${user.email}</td><td>${roleLabels[user.role] || user.role}</td><td>${user.company || "N/A"}</td><td>${user.assigned_booths.join(", ") || "N/A"}</td><td>${user.assigned_services.join(", ") || "N/A"}</td><td>${user.last_login ? formatDateTime(user.last_login) : "Never"}</td><td><span class="user-status ${user.status}">${user.status === "active" ? "Active" : "Inactive"}</span></td><td class="user-actions"><button type="button" class="user-action-btn edit-user-btn">Edit</button><button type="button" class="user-action-btn delete delete-user-btn">Delete</button></td>`;
    row
      .querySelector(".edit-user-btn")
      .addEventListener("click", () => openUserModal(user));
    row.querySelector(".delete-user-btn").addEventListener("click", () =>
      openCrudConfirmation({
        title: "Delete User",
        subtitle: "This action cannot be undone.",
        message: `Are you sure you want to delete user ${user.username}?`,
        confirmLabel: "Delete User",
        run: async () => {
          await api.delete(`/api/users/${user.id}`);
          await renderUsers();
        },
        successTitle: "User Deleted",
        successMessage: `${user.username} was deleted successfully.`,
      }),
    );
    tbody.appendChild(row);
  });
}

function openUserModal(user) {
  editingUserId = user ? user.id : null;
  const modal = document.getElementById("user-modal");
  document.getElementById("user-modal-title").textContent = user
    ? "Edit User"
    : "Add New User";
  document.getElementById("user-username").value = user?.username || "";
  document.getElementById("user-full-name").value = user?.full_name || "";
  document.getElementById("user-email").value = user?.email || "";
  document.getElementById("user-password").value = "";
  document.getElementById("user-confirm-password").value = "";
  document.getElementById("user-role").value = user?.role || "";
  document.getElementById("user-status").value = user?.status || "active";
  document.getElementById("user-company").value =
    user?.company === "Wina Bwangu"
      ? "wina_bwangu"
      : user?.company
        ? "other"
        : "";
  modal.querySelectorAll('input[name="user-booths"]').forEach((checkbox) => {
    checkbox.checked = !!user?.assigned_booths.includes(checkbox.value);
  });
  modal.querySelectorAll('input[name="user-services"]').forEach((checkbox) => {
    checkbox.checked = !!user?.assigned_services.includes(checkbox.value);
  });
  modal.querySelectorAll(".user-checkbox-grid").forEach((grid) => {
    const hint = grid.nextElementSibling;
    if (hint && hint.classList.contains("assignment-empty"))
      hint.hidden = !!grid.querySelector("input:checked");
  });
  openModal(modal);
}

export function setupUsersModal() {
  if (!canPerform("users.manage")) return;
  const modal = document.getElementById("user-modal");
  wireModalDismiss(modal);
  document
    .getElementById("add-user-btn")
    .addEventListener("click", () => openUserModal(null));
  modal.querySelectorAll(".user-checkbox-grid").forEach((grid) =>
    grid.addEventListener("change", () => {
      const hint = grid.nextElementSibling;
      if (hint && hint.classList.contains("assignment-empty"))
        hint.hidden = !!grid.querySelector("input:checked");
    }),
  );
  document.getElementById("save-user").addEventListener("click", () => {
    const username = document.getElementById("user-username").value.trim();
    const fullName = document.getElementById("user-full-name").value.trim();
    const email = document.getElementById("user-email").value.trim();
    const password = document.getElementById("user-password").value;
    const confirmPassword = document.getElementById(
      "user-confirm-password",
    ).value;
    const role = document.getElementById("user-role").value;
    const status = document.getElementById("user-status").value;
    const companyChoice = document.getElementById("user-company").value;
    const company =
      companyChoice === "wina_bwangu"
        ? "Wina Bwangu"
        : companyChoice === "other"
          ? "Other"
          : null;
    const assignedBooths = Array.from(
      modal.querySelectorAll('input[name="user-booths"]:checked'),
    ).map((checkbox) => checkbox.value);
    const assignedServices = Array.from(
      modal.querySelectorAll('input[name="user-services"]:checked'),
    ).map((checkbox) => checkbox.value);
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
    const userId = editingUserId;
    const isEditing = Boolean(userId);
    openCrudConfirmation({
      title: isEditing ? "Update User" : "Add User",
      subtitle: "Confirm the user details.",
      message: `${isEditing ? "Update" : "Create"} user ${username}?`,
      confirmLabel: isEditing ? "Update User" : "Add User",
      run: async () => {
        if (isEditing) await api.put(`/api/users/${userId}`, payload);
        else await api.post("/api/users", payload);
        closeModal(modal);
        await renderUsers();

        if (state.currentUser && state.currentUser.id === userId) {
          window.location.reload();
        }
      },
      successTitle: isEditing ? "User Updated" : "User Added",
      successMessage: `${username} was ${isEditing ? "updated" : "added"} successfully.`,
    });
  });
  document
    .getElementById("user-role-filter")
    .addEventListener("change", applyUserFilters);
  document
    .getElementById("user-status-filter")
    .addEventListener("change", applyUserFilters);
}
