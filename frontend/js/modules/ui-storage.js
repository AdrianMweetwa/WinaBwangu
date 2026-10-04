const SIDEBAR_STORAGE_KEY = "wb_sidebar_collapsed";

export function getSidebarCollapsed() {
  return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
}

export function setSidebarCollapsed(collapsed) {
  localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
}
