import { hostedButton } from "./html.js";
import { PASSKEY_COPY } from "./passkey-copy.js";

/** Lucide's key-round, in the same line weight as the other hosted icons. */
const PASSKEY_MARK = `<svg class="btn-mark" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/></svg>`;

/**
 * The passkey button. It starts hidden: the page script shows it only where the browser can use
 * passkeys, so nobody is offered something their browser cannot do.
 */
export function passkeyButton(label: string = PASSKEY_COPY.signIn.button): string {
  return hostedButton({
    label,
    type: "button",
    kind: "secondary",
    loadingLabel: PASSKEY_COPY.signIn.busy,
    leadingMark: PASSKEY_MARK,
    hidden: true,
    extraAttrs: { "data-passkey-button": "true" },
  });
}

/** The quiet line under the button for a prompt that was closed. Announced politely. */
export function passkeyNote(): string {
  return `<p id="passkey-note" class="passkey-note" role="status" aria-live="polite" hidden></p>`;
}
