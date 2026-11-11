import { submitEnabled } from "./turnstile.js";
import type { HostedAuthApi } from "./window-auth.js";

/**
 * The "complete the check" step shared by the sign-in pages: when the issuer asks for a Turnstile
 * check, the submit buttons wait for a token and the page says why.
 */
export function createCaptchaGate(auth: HostedAuthApi) {
  function gate(button: HTMLButtonElement | null): void {
    auth.onTokenChange((token) => {
      if (!button || button.getAttribute("aria-busy") === "true") return;
      button.disabled = !submitEnabled({ captchaRequired: true, token });
    });
  }

  return {
    /** True when the answer was a request for the check, and the page has now asked for it. */
    async handle(data: unknown, buttons: Array<HTMLButtonElement | null>): Promise<boolean> {
      if (!auth.isCaptchaRequired(data)) return false;
      for (const button of buttons) gate(button);
      await auth.ensureTurnstile(buttons);
      auth.showError(auth.CAPTCHA_REQUIRED);
      return true;
    },
  };
}
