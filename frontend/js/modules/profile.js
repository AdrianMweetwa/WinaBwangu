import { state } from "./state.js";
import { roleLabels } from "./roles.js";

export function updateProfileIdentity(currentUser = state.currentUser) {
  const user = currentUser || state.users.find((entry) => entry.role === "system_admin") || state.users[0];
  if (!user) return;

  const initials = user.full_name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  document.getElementById("profile-initials").textContent = initials;
  document.getElementById("profile-name").textContent = user.full_name;
  document.getElementById("profile-role").textContent = roleLabels[user.role] || user.role;
  document.getElementById("profile-welcome-name").textContent = user.full_name;
  document.getElementById("profile-welcome-role").textContent = user.role === "system_admin"
    ? "System Admin"
    : (roleLabels[user.role] || user.role);
}
