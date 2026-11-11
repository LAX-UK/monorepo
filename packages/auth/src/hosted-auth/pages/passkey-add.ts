import {
  buildHostedAuthHtml,
  escapeHostedHtml,
  floatingInput,
  hostedButton,
  statusRegions,
  viewChrome,
} from "../html.js";
import { PASSKEY_COPY } from "../passkey-copy.js";
import { type HostedAuthView, hostedAuthViewFromSearch } from "../view.js";

export { HOSTED_PASSKEY_ADD_SCRIPT } from "../scripts.js";

const COPY = PASSKEY_COPY.add;

export type HostedAddPasskeyInput = {
  /** LAX Account's Security page: where Cancel and Back lead, and nowhere else. */
  returnUrl: string;
  /** The same page told a passkey was added, where Save leads (it shows the confirmation). */
  savedReturnUrl?: string;
};

/**
 * The issuer's page for making a passkey, reached from LAX Account's one-time hand-off. A passkey
 * belongs to this address, so it is made here and never on a product's own page. States: ready,
 * waiting for the device, saved (name it), and the ways it stops; the script shows each.
 */
export function buildHostedAddPasskeyHtml(
  input: HostedAddPasskeyInput,
  view: HostedAuthView = hostedAuthViewFromSearch(""),
): string {
  const back = escapeHostedHtml(input.returnUrl);
  return buildHostedAuthHtml({
    title: COPY.title,
    description: COPY.lead,
    ...viewChrome(view),
    showDestination: false,
    productBack: { href: input.returnUrl, label: COPY.backToAccount },
    body: `<div id="passkey-add" class="auth-stack" data-return-url="${escapeHostedHtml(input.savedReturnUrl ?? input.returnUrl)}">
      <div id="passkey-ready" class="auth-form">
        <p class="auth-hint">${escapeHostedHtml(COPY.syncNote)}</p>
        <p id="passkey-note" class="passkey-note" role="status" aria-live="polite" hidden></p>
        ${hostedButton({ id: "passkey-create", type: "button", label: COPY.create, loadingLabel: COPY.waiting })}
        <a id="passkey-cancel" class="btn btn-secondary" href="${back}">${escapeHostedHtml(COPY.cancel)}</a>
      </div>
      <div id="passkey-unsupported" class="auth-form" hidden>
        <p class="auth-hint" role="status">${escapeHostedHtml(COPY.unsupported)}</p>
        <a class="btn btn-primary" href="${back}">${escapeHostedHtml(COPY.backToAccount)}</a>
      </div>
      <section id="passkey-saved" class="auth-form" hidden>
        <p id="passkey-saved-lead" class="lead"></p>
        <form id="passkey-name-form" class="auth-form" novalidate>
          ${floatingInput({
            id: "passkey-name",
            label: COPY.nameLabel,
            hint: COPY.nameHint,
            maxlength: 80,
            exactEntry: true,
          })}
          ${hostedButton({ id: "passkey-save", label: COPY.save, loadingLabel: COPY.saving })}
        </form>
      </section>
      ${statusRegions()}
    </div>`,
    scriptSrc: "/hosted-passkey-add.js",
  });
}

/** Shown when the one-time permission is spent, expired or belongs to another sign-in. */
export function buildHostedPasskeyExpiredHtml(
  input: HostedAddPasskeyInput,
  view: HostedAuthView = hostedAuthViewFromSearch(""),
): string {
  return buildHostedAuthHtml({
    title: COPY.expiredTitle,
    description: COPY.expired,
    ...viewChrome(view),
    showDestination: false,
    body: `<div class="auth-form">
      <a id="passkey-back" class="btn btn-primary" href="${escapeHostedHtml(input.returnUrl)}">${escapeHostedHtml(COPY.backToAccount)}</a>
    </div>`,
  });
}
