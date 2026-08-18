function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const OIDC_CONSENT_SCRIPT = `document.getElementById("oidc-consent").addEventListener("submit", async (event) => {
  event.preventDefault();
  const accept = event.submitter && event.submitter.value === "accept";
  const consentCode = document.getElementById("consent-code").value;
  const response = await fetch("/api/auth/oauth2/consent", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accept, consent_code: consentCode })
  });
  const result = await response.json().catch(() => null);
  if (response.ok && result && typeof result.redirectURI === "string") {
    window.location.assign(result.redirectURI);
    return;
  }
  document.getElementById("error").hidden = false;
});`;

/** Minimal same-origin consent UI for the Better Auth OIDC provider. */
export function buildOidcConsentHtml(input: {
  clientName: string;
  scopes: string[];
  code: string;
}): string {
  const clientName = escapeHtml(input.clientName);
  const scopeItems = input.scopes.map((scope) => `<li>${escapeHtml(scope)}</li>`).join("");
  const code = escapeHtml(input.code);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Authorize ${clientName}</title>
</head>
<body>
  <main>
    <h1>Authorize ${clientName}</h1>
    <p>This application is requesting access to:</p>
    <ul>${scopeItems}</ul>
    <form id="oidc-consent">
      <input id="consent-code" type="hidden" value="${code}">
      <button type="submit" name="decision" value="deny">Deny</button>
      <button type="submit" name="decision" value="accept">Allow</button>
    </form>
    <p id="error" role="alert" hidden>Authorization failed. Please try again.</p>
  </main>
  <script src="/oidc-consent.js" defer></script>
</body>
</html>`;
}
