import { renderDashboard } from "./modules/dashboard.js";
import { renderCashServices, setupCashServices } from "./modules/cash-services.js";
import { renderSettings, setupSettingsModals } from "./modules/settings.js";
import { renderTransactions, setupTransactions } from "./modules/transactions.js";
import { setupReceiptPrinting } from "./modules/receipt.js";
import { renderUsers, setupUsersModal } from "./modules/users.js";
import { createPageNavigator, setupNavigation, setupSidebarToggle } from "./modules/navigation.js";
import { setupTopBar } from "./modules/topbar.js";
import { confirmCrudAction, wireModalDismiss } from "./modules/modal.js";
import { logout, requireSession } from "./modules/auth.js";

const pageLoaders = {
  dashboard: renderDashboard,
  "cash-services": renderCashServices,
  transactions: renderTransactions,
  settings: renderSettings,
  users: renderUsers,
};

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireSession().catch((error) => {
    console.error("Unable to verify the current session:", error);
    return null;
  });
  if (!user) return;

  const showPage = createPageNavigator(pageLoaders);
  setupNavigation(showPage);
  setupSidebarToggle();
  setupTopBar(showPage);
  setupCashServices();
  setupTransactions();
  setupReceiptPrinting();
  setupSettingsModals();
  setupUsersModal();

  wireModalDismiss(document.getElementById("receipt-modal"));
  wireModalDismiss(document.getElementById("transaction-confirmation-modal"));
  wireModalDismiss(document.getElementById("transaction-edit-modal"));
  wireModalDismiss(document.getElementById("crud-confirmation-modal"));
  wireModalDismiss(document.getElementById("crud-success-modal"));
  document.getElementById("confirm-crud-action").addEventListener("click", confirmCrudAction);
  document.getElementById("logout-button").addEventListener("click", logout);

  showPage("dashboard");
});
