import { resolveRegisteredClientIdByName, selectHostedBrand } from "../brand.js";
import { parseHostedAuthFlow } from "../flow-context.js";
import { buildHostedAuthHtml, escapeHostedHtml, hostedButton, statusRegions } from "../html.js";
import { describeHostedScopes } from "../scopes.js";
import { EMPTY_HOSTED_AUTH_CAPABILITIES, buildHostedAuthPageConfig } from "../view.js";

export { OIDC_CONSENT_SCRIPT } from "../scripts.js";

export function buildOidcConsentHtml(input: {
  clientName: string;
  scopes: string[];
  code: string;
}): string {
  const clientId = resolveRegisteredClientIdByName(input.clientName);
  const flow = parseHostedAuthFlow(new URLSearchParams(clientId ? { client_id: clientId } : {}));
  // Raw scope strings are never shown: they mean nothing to the person being asked.
  const scopeItems = describeHostedScopes(input.scopes)
    .map((line) => `<li>${escapeHostedHtml(line)}</li>`)
    .join("");
  const code = escapeHostedHtml(input.code);
  return buildHostedAuthHtml({
    title: `Authorise ${input.clientName}`,
    description: "This app would like to:",
    brand: selectHostedBrand(clientId),
    config: buildHostedAuthPageConfig(flow, EMPTY_HOSTED_AUTH_CAPABILITIES),
    body: `<ul>${scopeItems}</ul>
    <form id="oidc-consent" class="auth-form">
      <input id="consent-code" type="hidden" value="${code}">
      <div class="actions">
        ${hostedButton({ label: "Deny", kind: "secondary", name: "decision", value: "deny" })}
        ${hostedButton({ label: "Authorise", name: "decision", value: "accept", loadingLabel: "Authorising…" })}
      </div>
    </form>
    ${statusRegions()}`,
    scriptSrc: "/oidc-consent.js",
  });
}
