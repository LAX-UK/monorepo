import { escapeHostedHtml } from "./html.js";
import { hostedAgreementLinks } from "./legal-links.js";
import type { HostedAuthView } from "./view.js";

export type AgreementCopy = { lead: string; terms: string; privacy: string };

/** "<lead> Terms and Privacy notice", linking the documents of the company behind the product. */
export function agreementLine(view: HostedAuthView, copy: AgreementCopy): string {
  const links = hostedAgreementLinks(view.flow.product, view.capabilities);
  const link = (href: string, label: string) =>
    `<a class="text-link" href="${escapeHostedHtml(href)}">${escapeHostedHtml(label)}</a>`;
  return `<p class="auth-fineprint">${escapeHostedHtml(copy.lead)} ${link(links.terms, copy.terms)} and ${link(links.privacy, copy.privacy)}.</p>`;
}
