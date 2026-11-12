import {
  authDivider,
  buildHostedAuthHtml,
  continuationAnchor,
  escapeHostedHtml,
  hostedButton,
  passwordField,
  statusRegions,
  turnstileHost,
  viewChrome,
} from "../html.js";
import { passkeyButton, passkeyNote } from "../passkey-actions.js";
import { PASSKEY_COPY } from "../passkey-copy.js";
import { socialProviderButton } from "../social-actions.js";
import type { SocialProviderId } from "../social-providers.js";
import { type HostedAuthView, hostedAuthViewFromSearch } from "../view.js";

export { HOSTED_CONFIRM_SCRIPT } from "../scripts.js";

const COPY = PASSKEY_COPY.confirm;

/** What the signed-in person can use to prove it is them again: only what their account has. */
export type ConfirmMethods = {
  password: boolean;
  passkey: boolean;
  providers: readonly SocialProviderId[];
  /** Staff accounts never use Google or Apple, whatever is linked to them. */
  staff: boolean;
};

/** Whether the "Confirm it's you" page has any way to offer; without one the ordinary page is used. */
export function hasConfirmMethod(methods: ConfirmMethods, view: HostedAuthView): boolean {
  return (
    methods.password || passkeyOffered(methods, view) || offeredProviders(methods, view).length > 0
  );
}

function passkeyOffered(methods: ConfirmMethods, view: HostedAuthView): boolean {
  return methods.passkey && view.capabilities.passkeysEnabled === true;
}

function offeredProviders(methods: ConfirmMethods, view: HostedAuthView): SocialProviderId[] {
  if (methods.staff) return [];
  return methods.providers.filter((provider) =>
    provider === "google" ? view.capabilities.googleEnabled : view.capabilities.appleEnabled,
  );
}

/**
 * The sign-in a person is sent to before a sensitive change: Account asked the issuer for a fresh
 * sign-in. The email is fixed to the person who is signed in, so a passkey, which names no email
 * of its own, can only confirm them: "Not you?" signs out and starts over. A passkey leads when
 * the person has one, and only the methods their account has are offered.
 */
export function buildHostedConfirmHtml(
  input: { email: string; methods: ConfirmMethods },
  view: HostedAuthView = hostedAuthViewFromSearch(""),
): string {
  const { email, methods } = input;
  const passkey = passkeyOffered(methods, view);
  const providers = offeredProviders(methods, view);
  const accountOrigin = view.capabilities.accountOrigin?.replace(/\/$/, "");
  const productBack = accountOrigin
    ? { href: `${accountOrigin}/account/security`, label: PASSKEY_COPY.add.backToAccount }
    : null;
  const passkeyBlock = passkey
    ? `<div class="social-actions" data-login-chrome="methods" data-methods-empty="true" hidden>
        ${passkeyButton(COPY.usePasskey)}${passkeyNote()}${methods.password ? authDivider() : ""}
      </div>`
    : "";
  const passwordForm = methods.password
    ? `<form id="confirm-form" class="auth-form" novalidate>
        ${passwordField({ id: "password", label: "Password", autocomplete: "current-password" })}
        <div class="field-row-end">${continuationAnchor("Forgot your password?", "/forgot-password", view.flow)}</div>
        ${hostedButton({ label: "Continue", loadingLabel: "Signing in…" })}
        ${turnstileHost()}
      </form>`
    : "";
  const providerButtons = providers.map((provider) => socialProviderButton(provider)).join("");
  return buildHostedAuthHtml({
    title: COPY.title,
    description: view.flow.reauthReason ? COPY.leadByReason[view.flow.reauthReason] : COPY.lead,
    ...viewChrome(view),
    showDestination: false,
    ...(productBack ? { productBack } : {}),
    body: `<div id="confirm-root" class="auth-stack" data-email="${escapeHostedHtml(email)}">
      <div class="confirm-person">
        <span class="confirm-person-email">${escapeHostedHtml(email)}</span>
        ${hostedButton({ id: "confirm-not-you", type: "button", kind: "link", label: COPY.notYou, loadingLabel: COPY.notYouBusy })}
      </div>
      ${passkeyBlock}
      ${passwordForm}
      ${providerButtons ? `<div class="social-actions">${providerButtons}</div>` : ""}
      ${statusRegions()}
    </div>`,
    scriptSrc: "/hosted-confirm.js",
  });
}
