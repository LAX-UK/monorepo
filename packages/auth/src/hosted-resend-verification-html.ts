import { buildHostedAuthHtml } from "./hosted-auth-shell.js";

export const HOSTED_RESEND_VERIFICATION_SCRIPT = `const params = new URLSearchParams(window.location.search);
const callbackURL = params.get("callbackURL");
const emailInput = document.getElementById("email");
const errorEl = document.getElementById("error");
const successEl = document.getElementById("success");
const prefilledEmail = params.get("email");
if (prefilledEmail && emailInput) emailInput.value = prefilledEmail;

document.getElementById("resend-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.hidden = true;
  successEl.hidden = true;
  const email = emailInput.value.trim();
  const verifyCallback = new URL("/verify-email", window.location.origin);
  verifyCallback.searchParams.set("email", email);
  if (callbackURL) verifyCallback.searchParams.set("callbackURL", callbackURL);
  const response = await fetch("/api/auth/send-verification-email", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      callbackURL: verifyCallback.toString(),
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    errorEl.textContent = payload?.message ?? "Unable to send verification email right now.";
    errorEl.hidden = false;
    return;
  }
  successEl.textContent = "If an account exists for that email, a verification link was sent.";
  successEl.hidden = false;
});`;

export function buildHostedResendVerificationHtml(): string {
  return buildHostedAuthHtml({
    title: "Resend verification",
    description: "Enter your email address and we will send a fresh verification link.",
    body: `<form id="resend-form">
      <label for="email">Email
        <input id="email" type="email" autocomplete="username" required>
      </label>
      <button type="submit">Send verification email</button>
      <p id="error" role="alert" hidden></p>
      <p id="success" role="status" hidden></p>
      <div class="links"><a href="/login">Back to sign in</a></div>
    </form>`,
    scriptSrc: "/hosted-resend-verification.js",
  });
}
