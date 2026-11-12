import { type PasskeyRuntime, browserPasskeyRuntime } from "./passkey-ceremony.js";
import { createPasskeySignIn } from "./passkey-sign-in.js";
import type { HostedAuthApi } from "./window-auth.js";

function buttons(): HTMLButtonElement[] {
  return [...document.querySelectorAll("[data-passkey-button]")].filter(
    (node): node is HTMLButtonElement => node instanceof HTMLButtonElement,
  );
}

/** Whether the email box on this page is marked so the browser can offer saved passkeys in it. */
function hasAutofillField(): boolean {
  return document.querySelector('input[autocomplete~="webauthn"]') !== null;
}

/**
 * Connects the passkey button and the email box autofill on a hosted page to the sign-in
 * controller. Pages without a passkey button (passkeys switched off) are left exactly as they are.
 */
export function bindPasskeySignIn(
  auth: HostedAuthApi,
  runtime: PasskeyRuntime = browserPasskeyRuntime,
): void {
  const all = buttons();
  if (all.length === 0) return;
  const note = document.getElementById("passkey-note");
  const methods = document.querySelector("[data-login-chrome=methods]");

  const controller = createPasskeySignIn({
    runtime,
    hasAutofillField: hasAutofillField(),
    view: {
      reveal() {
        for (const button of all) button.hidden = false;
        if (methods instanceof HTMLElement) {
          delete methods.dataset.methodsEmpty;
          methods.hidden = false;
        }
      },
      busy(busy) {
        for (const button of all) auth.setBusy(button, busy);
      },
      quietNote(message) {
        if (!note) return;
        note.textContent = message ?? "";
        note.hidden = message === null;
      },
      summary: (message) => auth.showError(message),
      clearStatus: () => auth.hideStatus(),
      proceed: (data) => auth.continueAfterAuth(data),
      focusButton: () => all[0]?.focus(),
    },
  });

  for (const button of all) {
    button.addEventListener("click", () => {
      void controller.signIn();
    });
  }
  controller.start();
  // The quiet request waits for the person to reach for the email box.
  const field = document.querySelector('input[autocomplete~="webauthn"]');
  const arm = () => void controller.armAutofill();
  field?.addEventListener("focus", arm, { once: true });
  field?.addEventListener("pointerdown", arm, { once: true });
}
