import { buildHostedAuthHtml } from "./hosted-auth-shell.js";

export const HOSTED_FORGOT_PASSWORD_SCRIPT = `const errorEl = document.getElementById("error");
const successEl = document.getElementById("success");

document.getElementById("forgot-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.hidden = true;
  successEl.hidden = true;
  const email = document.getElementById("email").value.trim();
  const response = await fetch("/api/auth/forget-password", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      redirectTo: new URL("/reset-password", window.location.origin).toString(),
    }),
  });
  if (!response.ok) {
    errorEl.textContent = "Unable to send reset email right now. Try again later.";
    errorEl.hidden = false;
    return;
  }
  successEl.textContent = "If an account exists for that email, reset instructions were sent.";
  successEl.hidden = false;
});`;

export function buildHostedForgotPasswordHtml(): string {
  return buildHostedAuthHtml({
    title: "Reset password",
    description: "Enter your email and we will send reset instructions.",
    body: `<form id="forgot-form">
      <label for="email">Email
        <input id="email" type="email" autocomplete="username" required>
      </label>
      <button type="submit">Send reset link</button>
      <p id="error" role="alert" hidden></p>
      <p id="success" role="status" hidden></p>
      <div class="links"><a href="/login">Back to sign in</a></div>
    </form>`,
    scriptSrc: "/hosted-forgot-password.js",
  });
}

export const HOSTED_RESET_PASSWORD_SCRIPT = `const params = new URLSearchParams(window.location.search);
const token = params.get("token");
const errorEl = document.getElementById("error");

if (!token) {
  errorEl.textContent = "Reset link is invalid or expired.";
  errorEl.hidden = false;
  document.getElementById("reset-form").hidden = true;
}

document.getElementById("reset-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.hidden = true;
  const password = document.getElementById("password").value;
  const response = await fetch("/api/auth/reset-password", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ newPassword: password, token }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    errorEl.textContent = payload?.message ?? "Unable to reset password.";
    errorEl.hidden = false;
    return;
  }
  window.location.assign("/login");
});`;

export function buildHostedResetPasswordHtml(): string {
  return buildHostedAuthHtml({
    title: "Choose new password",
    description: "Set a new password for your LAX account.",
    body: `<form id="reset-form">
      <label for="password">New password
        <input id="password" type="password" autocomplete="new-password" minlength="12" required>
      </label>
      <button type="submit">Update password</button>
      <p id="error" role="alert" hidden></p>
    </form>`,
    scriptSrc: "/hosted-reset-password.js",
  });
}
