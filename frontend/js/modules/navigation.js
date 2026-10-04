import { getSidebarCollapsed, setSidebarCollapsed } from "./ui-storage.js";
import { canAccessPage } from "./auth.js";

export function createPageNavigator(pageLoaders) {
  function showPage(pageId) {
    if (!canAccessPage(pageId)) return;
    document.querySelectorAll(".page-content").forEach((el) => {
      el.classList.toggle("active", el.id === pageId);
    });
    document.querySelectorAll("nav a[data-page]").forEach((el) => {
      el.classList.toggle("active", el.dataset.page === pageId);
    });
    const loader = pageLoaders[pageId];
    if (loader) loader();
  }

  return showPage;
}

export function setupNavigation(showPage) {
  document.querySelectorAll("nav a[data-page]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showPage(link.dataset.page);
    });
  });
}

export function setupSidebarToggle() {
  const toggle = document.getElementById("sidebar-toggle");
  if (!toggle) return;

  const setCollapsedState = (collapsed) => {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
    toggle.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
  };

  setCollapsedState(getSidebarCollapsed());
  toggle.addEventListener("click", () => {
    const collapsed = !document.body.classList.contains("sidebar-collapsed");
    setCollapsedState(collapsed);
    setSidebarCollapsed(collapsed);
  });
}
