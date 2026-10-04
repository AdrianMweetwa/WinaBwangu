import { api } from "./modules/api.js";

function showFeedback(message, type = "error") {
  const feedback = document.getElementById("login-feedback");
  feedback.textContent = message;
  feedback.className = `login-feedback ${type}`;
  feedback.hidden = false;
}

function setupPasswordToggle() {
  const passwordInput = document.getElementById("login-password");
  const toggle = document.getElementById("login-password-toggle");
  if (!passwordInput || !toggle) return;

  toggle.addEventListener("click", () => {
    const showingPassword = passwordInput.type === "text";
    passwordInput.type = showingPassword ? "password" : "text";
    toggle.setAttribute("aria-pressed", String(!showingPassword));
    toggle.setAttribute("aria-label", showingPassword ? "Show password" : "Hide password");
    toggle.querySelector("span").textContent = showingPassword ? "Show" : "Hide";
  });
}

function setupLoginForm() {
  const form = document.getElementById("login-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const identifier = document.getElementById("login-identifier").value.trim();
    const password = document.getElementById("login-password").value;
    const remember = document.querySelector('input[name="remember"]').checked;
    if (!identifier || !password) {
      showFeedback("Enter your username/email and password.");
      return;
    }

    const submit = form.querySelector(".login-submit");
    submit.disabled = true;
    submit.textContent = "Signing in...";
    try {
      await api.post("/api/auth/login", { identifier, password, remember });
      window.location.replace("/");
    } catch (error) {
      showFeedback(error.message || "Unable to sign in.");
    } finally {
      submit.disabled = false;
      submit.textContent = "Sign in";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  api.get("/api/auth/me").then(() => {
    window.location.replace("/");
  }).catch(() => {
    // A 401 is expected for signed-out visitors.
  });
  setupPasswordToggle();
  setupLoginForm();
});
