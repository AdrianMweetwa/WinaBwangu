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
      closeMobileSidebar();
    });
  });
}

function closeMobileSidebar() {
  const sidebar = document.getElementById("primary-navigation");
  const backdrop = document.getElementById("sidebar-backdrop");
  document.body.classList.remove("mobile-sidebar-open");
  if (backdrop) backdrop.hidden = true;
  if (sidebar && window.matchMedia("(max-width: 900px)").matches) {
    sidebar.inert = true;
    sidebar.setAttribute("aria-hidden", "true");
  }
}

export function setupSidebarToggle() {
  const toggle = document.getElementById("sidebar-toggle");
  if (!toggle) return;
  const sidebar = document.getElementById("primary-navigation");
  const backdrop = document.getElementById("sidebar-backdrop");
  const mobileQuery = window.matchMedia("(max-width: 900px)");
  let collapsed = getSidebarCollapsed();

  const syncToggleState = () => {
    const mobileOpen = document.body.classList.contains("mobile-sidebar-open");
    if (sidebar) {
      sidebar.inert = mobileQuery.matches && !mobileOpen;
      sidebar.setAttribute("aria-hidden", String(mobileQuery.matches && !mobileOpen));
    }
    if (mobileQuery.matches) {
      toggle.setAttribute("aria-expanded", String(mobileOpen));
      toggle.setAttribute("aria-label", mobileOpen ? "Close navigation" : "Open navigation");
      toggle.title = mobileOpen ? "Close navigation" : "Open navigation";
      return;
    }

    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
    toggle.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
  };

  const setCollapsedState = (collapsed) => {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    syncToggleState();
  };

  const closeMobile = () => {
    closeMobileSidebar();
    syncToggleState();
  };

  setCollapsedState(collapsed);
  toggle.addEventListener("click", () => {
    if (mobileQuery.matches) {
      const open = !document.body.classList.contains("mobile-sidebar-open");
      document.body.classList.toggle("mobile-sidebar-open", open);
      if (backdrop) backdrop.hidden = !open;
      syncToggleState();
      return;
    }

    collapsed = !collapsed;
    setCollapsedState(collapsed);
    setSidebarCollapsed(collapsed);
  });

  backdrop?.addEventListener("click", closeMobile);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("mobile-sidebar-open")) {
      closeMobile();
    }
  });

  const handleViewportChange = () => {
    if (!mobileQuery.matches) closeMobile();
    syncToggleState();
  };

  if (typeof mobileQuery.addEventListener === "function") {
    mobileQuery.addEventListener("change", handleViewportChange);
  } else {
    mobileQuery.addListener(handleViewportChange);
  }
}
