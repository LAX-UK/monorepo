import { socialErrorMessage } from "./social-errors.js";
import type { HostedAuthApi } from "./window-auth.js";

function asButton(node: Element | null): HTMLButtonElement | null {
  return node instanceof HTMLButtonElement ? node : null;
}

export function bindSocialSignIn(auth: HostedAuthApi): void {
  for (const node of document.querySelectorAll("[data-social-provider]")) {
    const button = asButton(node);
    if (!button) continue;
    const labelEl = button.querySelector(".btn-label");
    button.dataset.label = labelEl?.textContent ?? button.textContent ?? "";
    button.addEventListener("click", async () => {
      auth.hideStatus();
      auth.setBusy(button, true);
      try {
        const callbackURL = auth.productHintLoginUrl();
        const { response, data } = await auth.postJson("/api/auth/sign-in/social", {
          provider: button.getAttribute("data-social-provider"),
          callbackURL,
          errorCallbackURL: callbackURL,
        });
        if (!response.ok) {
          auth.showError(auth.GENERIC_NETWORK);
          return;
        }
        auth.continueAfterAuth(data);
      } catch {
        auth.showError(auth.GENERIC_NETWORK);
      } finally {
        auth.setBusy(button, false);
      }
    });
  }
}

export function bindSocialCallbackError(auth: HostedAuthApi): void {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("error");
  const message = socialErrorMessage(code);
  if (!message) return;
  auth.showError(message);
  params.delete("error");
  params.delete("error_description");
  const next = `${window.location.pathname}${params.size ? `?${params.toString()}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", next);
}
