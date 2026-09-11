import { buildHostedAuthHtml } from "./hosted-auth-shell.js";

export const HOSTED_LOGIN_SCRIPT = `const params = new URLSearchParams(window.location.search);
const callbackURL = params.get("callbackURL");
const errorEl = document.getElementById("error");

function redirectAfterSignIn(payload) {
  if (payload && typeof payload.url === "string") {
    window.location.assign(payload.url);
    return;
  }
  if (callbackURL) {
    try {
      const parsed = new URL(callbackURL, window.location.origin);
      if (parsed.origin === window.location.origin) {
        window.location.assign(parsed.toString());
        return;
      }
    } catch {}
  }
  window.location.assign("/");
}

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.hidden = true;
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const response = await fetch("/api/auth/sign-in/email", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      ...(callbackURL ? { callbackURL } : {}),
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    errorEl.textContent = payload?.message ?? "Sign-in failed. Check your email and password.";
    errorEl.hidden = false;
    return;
  }
  redirectAfterSignIn(payload);
});`;

/** Hosted credential login for OIDC loginPage redirects on the Identity issuer. */
export function buildHostedLoginHtml(): string {
  return buildHostedAuthHtml({
    title: "Sign in",
    description: "Use your LAX account to continue.",
    body: `<form id="login-form">
      <label for="email">Email
        <input id="email" type="email" autocomplete="username" required>
      </label>
      <label for="password">Password
        <input id="password" type="password" autocomplete="current-password" required>
      </label>
      <button type="submit">Continue</button>
      <p id="error" role="alert" hidden></p>
      <div class="links">
        <a href="/forgot-password">Forgot password</a>
        <a href="/sign-up">Create account</a>
      </div>
    </form>`,
    scriptSrc: "/hosted-login.js",
  });
}
