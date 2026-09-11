import { buildHostedAuthHtml } from "./hosted-auth-shell.js";

export const HOSTED_SIGN_UP_SCRIPT = `const params = new URLSearchParams(window.location.search);
const callbackURL = params.get("callbackURL");
const errorEl = document.getElementById("error");
const successEl = document.getElementById("success");

document.getElementById("signup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.hidden = true;
  successEl.hidden = true;
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const response = await fetch("/api/auth/sign-up/email", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      email,
      password,
      ...(callbackURL ? { callbackURL } : {}),
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    errorEl.textContent = payload?.message ?? "Registration failed. Try a different email.";
    errorEl.hidden = false;
    return;
  }
  successEl.textContent = "Account created. Check your email if verification is required.";
  successEl.hidden = false;
  if (payload && typeof payload.url === "string") {
    window.location.assign(payload.url);
  }
});`;

export function buildHostedSignUpHtml(): string {
  return buildHostedAuthHtml({
    title: "Create account",
    description: "Join LAX to shop, bid, and manage your profile.",
    body: `<form id="signup-form">
      <label for="name">Full name
        <input id="name" autocomplete="name" required>
      </label>
      <label for="email">Email
        <input id="email" type="email" autocomplete="username" required>
      </label>
      <label for="password">Password
        <input id="password" type="password" autocomplete="new-password" minlength="12" required>
      </label>
      <button type="submit">Create account</button>
      <p id="error" role="alert" hidden></p>
      <p id="success" role="status" hidden></p>
      <div class="links"><a href="/login">Already have an account?</a></div>
    </form>`,
    scriptSrc: "/hosted-sign-up.js",
  });
}
