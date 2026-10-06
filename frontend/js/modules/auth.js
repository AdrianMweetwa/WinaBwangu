import { api } from "./api.js";
import { state } from "./state.js";

export const rolePermissions = {
  system_admin: ["dashboard", "transactions", "settings", "users"],
  admin_agent: ["dashboard", "transactions", "settings"],
  agent: ["dashboard", "cash-services", "transactions"],
};

export const roleCapabilities = {
  system_admin: [
    "catalog.view",
    "settings.view",
    "settings.write",
    "transactions.view",
    "transactions.create",
    "users.manage",
  ],
  admin_agent: [
    "catalog.view",
    "settings.view",
    "transactions.view",
    "transactions.create",
  ],
  agent: ["catalog.view", "transactions.view", "transactions.create"],
};

export function canAccessPage(pageId, user = state.currentUser) {
  return Boolean(user && rolePermissions[user.role]?.includes(pageId));
}

export function canPerform(capability, user = state.currentUser) {
  return Boolean(user && roleCapabilities[user.role]?.includes(capability));
}

function setAccessVisibility(element, visible) {
  if (!element) return;
  element.hidden = !visible;
  element.classList.toggle("access-hidden", !visible);
  element.setAttribute("aria-hidden", String(!visible));
  element.tabIndex = visible ? 0 : -1;
}

export function applyAccessControl(user) {
  state.currentUser = user;
  document.querySelectorAll("nav a[data-page]").forEach((link) => {
    setAccessVisibility(link, canAccessPage(link.dataset.page, user));
  });
  const usersLink = document.getElementById("profile-users-link");
  setAccessVisibility(usersLink, canAccessPage("users", user));
  document.body.classList.add("access-ready");
  document.body.classList.remove("access-pending");
}

export async function requireSession() {
  try {
    const { user } = await api.get("/api/auth/me");
    applyAccessControl(user);
    return user;
  } catch (error) {
    if (error.message === "Authentication required") {
      window.location.replace("/login");
      return null;
    }
    throw error;
  }
}

export async function logout() {
  await api.post("/api/auth/logout");
  window.location.replace("/login");
}
