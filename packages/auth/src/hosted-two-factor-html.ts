function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const HOSTED_TWO_FACTOR_SCRIPT = `const params = new URLSearchParams(window.location.search);
const next = params.get("next");
const callbackURL = params.get("callbackURL");
const errorEl = document.getElementById("error");
const trustDevice = () => document.getElementById("trust-device").checked;

function safeRedirectUrl(candidate) {
  if (typeof candidate === "string" && candidate.startsWith("/") && !candidate.startsWith("//")) {
    return candidate;
  }
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  if (callbackURL) {
    try {
      const parsed = new URL(callbackURL, window.location.origin);
      if (parsed.origin === window.location.origin) return parsed.toString();
    } catch {}
  }
  return "/";
}

async function submit(endpoint, body) {
  errorEl.hidden = true;
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    errorEl.textContent = payload?.message ?? "Verification failed. Try again.";
    errorEl.hidden = false;
    return;
  }
  const redirectUrl = payload?.url ?? safeRedirectUrl(null);
  window.location.assign(redirectUrl);
}

document.getElementById("totp-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = document.getElementById("totp-code").value.trim();
  await submit("/api/auth/two-factor/verify-totp", {
    code,
    trustDevice: trustDevice(),
  });
});

document.getElementById("backup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = document.getElementById("backup-code").value.trim();
  await submit("/api/auth/two-factor/verify-backup-code", {
    code,
    trustDevice: trustDevice(),
  });
});`;

/** Same-origin TOTP challenge UI on the Identity issuer host. */
export function buildHostedTwoFactorHtml(input: {
  next?: string | null;
  callbackURL?: string | null;
}) {
  const query = new URLSearchParams();
  if (input.next) query.set("next", input.next);
  if (input.callbackURL) query.set("callbackURL", input.callbackURL);
  const hiddenQuery = query.toString();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Two-step verification</title>
</head>
<body>
  <main>
    <h1>Two-step verification</h1>
    <p>Enter the 6-digit code from your authenticator app.</p>
    <form id="totp-form">
      <label for="totp-code">Authenticator code</label>
      <input id="totp-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required>
      <label><input id="trust-device" type="checkbox"> Trust this device for 30 days</label>
      <button type="submit">Verify</button>
    </form>
    <hr>
    <form id="backup-form">
      <label for="backup-code">Backup code</label>
      <input id="backup-code" autocomplete="off" required>
      <button type="submit">Use backup code</button>
    </form>
    <p id="error" role="alert" hidden></p>
  </main>
  <script src="/hosted-two-factor.js" defer></script>
  ${hiddenQuery ? `<!-- preserved query: ${escapeHtml(hiddenQuery)} -->` : ""}
</body>
</html>`;
}
