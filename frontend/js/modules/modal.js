let pendingCrudAction = null;

export function openModal(modal) {
  modal.hidden = false;
  syncModalScrollLock();
}

export function closeModal(modal) {
  modal.hidden = true;
  if (modal.id === "crud-confirmation-modal") pendingCrudAction = null;
  syncModalScrollLock();
}

function syncModalScrollLock() {
  const hasOpenModal = [...document.querySelectorAll(".receipt-modal, .settings-modal")]
    .some((modal) => !modal.hidden);
  document.body.classList.toggle("modal-open", hasOpenModal);
}

export function openCrudConfirmation({ title, subtitle, message, confirmLabel, run, successTitle, successMessage }) {
  pendingCrudAction = { run, successTitle, successMessage };
  document.getElementById("crud-confirmation-title").textContent = title;
  document.getElementById("crud-confirmation-subtitle").textContent = subtitle || "Please review this action.";
  document.getElementById("crud-confirmation-message").textContent = message;
  document.getElementById("confirm-crud-action").textContent = confirmLabel || "Confirm";
  openModal(document.getElementById("crud-confirmation-modal"));
}

export function showCrudSuccess(title, message) {
  document.getElementById("crud-success-title").textContent = title;
  document.getElementById("crud-success-message").textContent = message;
  openModal(document.getElementById("crud-success-modal"));
}

export async function confirmCrudAction() {
  if (!pendingCrudAction) return;

  const action = pendingCrudAction;
  const confirmButton = document.getElementById("confirm-crud-action");
  confirmButton.disabled = true;
  closeModal(document.getElementById("crud-confirmation-modal"));

  try {
    await action.run();
    showCrudSuccess(action.successTitle, action.successMessage);
  } catch (err) {
    alert(err.message || "The operation could not be completed.");
  } finally {
    confirmButton.disabled = false;
    pendingCrudAction = null;
  }
}

export function wireModalDismiss(modal) {
  modal
    .querySelectorAll(
      ".settings-modal-close, .settings-modal-cancel, .settings-modal-backdrop, .receipt-close-btn, .receipt-done-btn, .receipt-modal-backdrop",
    )
    .forEach((el) => {
      el.addEventListener("click", () => closeModal(modal));
    });
}
