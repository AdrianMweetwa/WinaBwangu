import { api } from "./modules/api.js";

function showFeedback(message, type = "error") {
  const feedback = document.getElementById("recovery-feedback");
  feedback.textContent = message;
  feedback.className = `login-feedback ${type}`;
  feedback.hidden = false;
}

function setupRecoveryRequest() {
  const form = document.getElementById("forgot-password-form");
  const resetForm = document.getElementById("reset-password-form");
  const tokenBox = document.getElementById("recovery-token-box");
  const tokenText = document.getElementById("recovery-token");
  const resetToken = document.getElementById("reset-token");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const identifier = document.getElementById("forgot-identifier").value.trim();
    if (!identifier) {
      showFeedback("Enter your username or email.");
      return;
    }

    const submit = form.querySelector(".login-submit");
    submit.disabled = true;
    submit.textContent = "Creating request...";
    try {
      const response = await api.post("/api/auth/forgot-password", { identifier });
      showFeedback(response.message, "success");
      if (response.reset_token) {
        tokenText.textContent = response.reset_token;
        resetToken.value = response.reset_token;
        tokenBox.hidden = false;
        resetForm.hidden = false;
        resetForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } catch (error) {
      showFeedback(error.message || "Unable to create a reset request.");
    } finally {
      submit.disabled = false;
      submit.textContent = "Request password reset";
    }
  });
}

function setupPasswordReset() {
  const form = document.getElementById("reset-password-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = document.getElementById("reset-token").value.trim();
    const password = document.getElementById("reset-password").value;
    const confirmation = document.getElementById("reset-password-confirm").value;
    if (password.length < 8 || password !== confirmation) {
      showFeedback("Passwords must match and contain at least 8 characters.");
      return;
    }

    const submit = form.querySelector(".login-submit");
    submit.disabled = true;
    submit.textContent = "Saving password...";
    try {
      const response = await api.post("/api/auth/reset-password", { token, password });
      showFeedback(response.message, "success");
      form.reset();
      setTimeout(() => window.location.replace("/login"), 1000);
    } catch (error) {
      showFeedback(error.message || "Unable to reset password.");
    } finally {
      submit.disabled = false;
      submit.textContent = "Set new password";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupRecoveryRequest();
  setupPasswordReset();
});
