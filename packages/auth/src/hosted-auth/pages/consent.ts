import { REGISTERED_OIDC_CLIENT_IDS } from "@auction/identity-contracts";
import { selectHostedBrandFromClientName } from "../brand.js";
import { parseHostedAuthFlow } from "../flow-context.js";
import { buildHostedAuthHtml, escapeHostedHtml, hostedButton, statusRegions } from "../html.js";
import { EMPTY_HOSTED_AUTH_CAPABILITIES, buildHostedAuthPageConfig } from "../view.js";

export { OIDC_CONSENT_SCRIPT } from "../scripts.js";

export function buildOidcConsentHtml(input: {
  clientName: string;
  scopes: string[];
  code: string;
}): string {
  const brand = selectHostedBrandFromClientName(input.clientName);
  const clientId =
    brand.theme === "shop"
      ? REGISTERED_OIDC_CLIENT_IDS.LAX_SHOP_WEB
      : brand.theme === "bid"
        ? REGISTERED_OIDC_CLIENT_IDS.LAX_BID_WEB
        : "";
  const flow = parseHostedAuthFlow(new URLSearchParams(clientId ? { client_id: clientId } : {}));
  const scopeItems = input.scopes.map((scope) => `<li>${escapeHostedHtml(scope)}</li>`).join("");
  const code = escapeHostedHtml(input.code);
  return buildHostedAuthHtml({
    title: `Authorize ${input.clientName}`,
    description: "This application is requesting access to:",
    brand,
    config: buildHostedAuthPageConfig(flow, EMPTY_HOSTED_AUTH_CAPABILITIES),
    body: `<ul>${scopeItems}</ul>
    <form id="oidc-consent" class="auth-form">
      <input id="consent-code" type="hidden" value="${code}">
      <div class="actions">
        ${hostedButton({ label: "Deny", kind: "secondary", name: "decision", value: "deny" })}
        ${hostedButton({ label: "Allow", name: "decision", value: "accept", loadingLabel: "Allowing…" })}
      </div>
    </form>
    ${statusRegions()}`,
    scriptSrc: "/oidc-consent.js",
  });
}
