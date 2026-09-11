import { buildHostedAuthHtml } from "./hosted-auth-shell.js";

export const HOSTED_VERIFY_EMAIL_SCRIPT = `const params = new URLSearchParams(window.location.search);
const token = params.get("token");
const email = params.get("email") ?? "";
const callbackURL = params.get("callbackURL");
const errorEl = document.getElementById("error");
const successEl = document.getElementById("success");
const pendingEl = document.getElementById("pending");

function redirectAfterVerification(payload) {
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
  window.location.assign("/login");
}

async function verifyToken() {
  if (!token) return;
  pendingEl.hidden = false;
  const response = await fetch(\`/api/auth/verify-email?token=\${encodeURIComponent(token)}\`, {
    method: "GET",
    credentials: "same-origin",
    redirect: "manual",
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (location) {
      window.location.assign(location);
      return;
    }
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    errorEl.textContent = payload?.message ?? "Verification link is invalid or expired.";
    errorEl.hidden = false;
    pendingEl.hidden = true;
    return;
  }
  successEl.textContent = "Email verified. Redirecting…";
  successEl.hidden = false;
  redirectAfterVerification(payload);
}

verifyToken();`;

export function buildHostedVerifyEmailHtml(): string {
  return buildHostedAuthHtml({
    title: "Verify your email",
    description: "Open the verification link from your inbox or request a new one below.",
    body: `<div id="pending" hidden>
      <p class="lead">Verifying your email…</p>
    </div>
    <p id="success" role="status" hidden></p>
    <p id="error" role="alert" hidden></p>
    <div class="links">
      <a href="/resend-verification">Resend verification email</a>
      <a href="/login">Return to sign in</a>
    </div>`,
    scriptSrc: "/hosted-verify-email.js",
  });
}
