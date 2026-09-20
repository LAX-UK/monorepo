import {
  buildHostedAuthHtml,
  continuationAnchor,
  floatingInput,
  hostedButton,
  statusRegions,
  turnstileHost,
} from "../html.js";
import { type HostedAuthView, hostedAuthViewFromSearch } from "../view.js";

export { HOSTED_MAGIC_LINK_SCRIPT } from "../scripts.js";

export function buildHostedMagicLinkHtml(
  view: HostedAuthView = hostedAuthViewFromSearch(""),
): string {
  return buildHostedAuthHtml({
    title: "Email sign-in link",
    description: "We will email you a one-time link to continue.",
    brand: view.brand,
    config: view.config,
    body: `<form id="magic-link-form" class="auth-form" novalidate>
      ${floatingInput({ id: "email", label: "Email Address", type: "email", autocomplete: "username" })}
      ${hostedButton({ label: "Send sign-in link", loadingLabel: "Sending…" })}
      ${turnstileHost()}
      ${statusRegions()}
      <div class="links">${continuationAnchor("Back to sign in", "/login", view.flow)}</div>
    </form>`,
    scriptSrc: "/hosted-magic-link.js",
  });
}
