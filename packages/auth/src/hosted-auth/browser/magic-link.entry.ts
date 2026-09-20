import { HOSTED_AUTH_POLICY } from "../policy.js";
import { submitEnabled } from "./turnstile.js";
import { hostedAuth, inputValue, submitButton } from "./window-auth.js";

const auth = hostedAuth();
const form = document.getElementById("magic-link-form");
if (!(form instanceof HTMLFormElement)) {
  throw new Error("hosted magic-link form missing");
}
const submit = submitButton(form);
const cooldownMs = HOSTED_AUTH_POLICY.magicLinkCooldownMs;
let cooldownUntil = 0;

function bindCaptchaGate(button: HTMLButtonElement | null): void {
  auth.onTokenChange((token) => {
    if (!button || button.getAttribute("aria-busy") === "true") return;
    button.disabled = !submitEnabled({ captchaRequired: true, token });
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth.validateFields(["email"])) return;
  if (Date.now() < cooldownUntil) return;
  auth.hideStatus();
  auth.setBusy(submit, true);
  try {
    const { data } = await auth.postJson("/api/auth/sign-in/magic-link", {
      email: inputValue("email").trim(),
      callbackURL: auth.productHintLoginUrl(),
    });
    if (auth.isCaptchaRequired(data)) {
      bindCaptchaGate(submit);
      await auth.ensureTurnstile([submit]);
      auth.showError(auth.CAPTCHA_REQUIRED);
      return;
    }
    auth.showSuccess(auth.GENERIC_MAGIC_LINK);
    cooldownUntil = Date.now() + cooldownMs;
    if (submit) {
      submit.textContent = "Wait 30s to resend";
      window.setTimeout(() => {
        submit.textContent = submit.dataset.label || "Send sign-in link";
        auth.setBusy(submit, false);
      }, cooldownMs);
    }
  } catch {
    auth.showError(auth.GENERIC_NETWORK);
    auth.setBusy(submit, false);
  }
});
