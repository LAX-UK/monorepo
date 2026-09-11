import { buildHostedAuthHtml, escapeHostedHtml } from "./hosted-auth-shell.js";

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

/** Same-origin consent UI for the Better Auth OIDC provider. */
export function buildOidcConsentHtml(input: {
  clientName: string;
  scopes: string[];
  code: string;
}): string {
  const clientName = escapeHostedHtml(input.clientName);
  const scopeItems = input.scopes.map((scope) => `<li>${escapeHostedHtml(scope)}</li>`).join("");
  const code = escapeHostedHtml(input.code);
  return buildHostedAuthHtml({
    title: `Authorize ${clientName}`,
    description: "This application is requesting access to:",
    body: `<ul>${scopeItems}</ul>
    <form id="oidc-consent">
      <input id="consent-code" type="hidden" value="${code}">
      <button type="submit" name="decision" value="deny" class="secondary">Deny</button>
      <button type="submit" name="decision" value="accept">Allow</button>
    </form>
    <p id="error" role="alert" hidden>Authorization failed. Please try again.</p>`,
    scriptSrc: "/oidc-consent.js",
  });
}
