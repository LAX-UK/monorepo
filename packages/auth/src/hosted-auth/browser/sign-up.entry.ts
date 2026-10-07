import { signUpOutcome } from "./sign-up-outcome.js";
import { submitEnabled } from "./turnstile.js";
import { hostedAuth, inputValue, submitButton } from "./window-auth.js";

const auth = hostedAuth();
const form = document.getElementById("signup-form");
if (!(form instanceof HTMLFormElement)) {
  throw new Error("hosted sign-up form missing");
}

function bindCaptchaGate(button: HTMLButtonElement | null): void {
  auth.onTokenChange((token) => {
    if (!button || button.getAttribute("aria-busy") === "true") return;
    button.disabled = !submitEnabled({ captchaRequired: true, token });
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth.validateFields(["name", "email", "password"])) return;
  auth.hideStatus();
  const submit = submitButton(form, event);
  auth.setBusy(submit, true);
  try {
    const { response, data } = await auth.postJson("/api/auth/sign-up/email", {
      name: inputValue("name").trim(),
      email: inputValue("email").trim(),
      password: inputValue("password"),
    });
    if (auth.isCaptchaRequired(data)) {
      bindCaptchaGate(submit);
      await auth.ensureTurnstile([submit]);
      auth.showError(auth.CAPTCHA_REQUIRED);
      return;
    }
    const outcome = signUpOutcome({
      requireEmailVerification: auth.config.requireEmailVerification,
      status: response.status,
    });
    if (outcome === "check-email") {
      auth.showSuccess(auth.REGISTER_CHECK_EMAIL);
      return;
    }
    if (outcome === "generic-error") {
      auth.showError(auth.GENERIC_REGISTER);
      return;
    }
    auth.showSuccess("Account created. Check your email if verification is required.");
    if (data && typeof data === "object" && "url" in data && typeof data.url === "string") {
      auth.continueAfterAuth(data);
      return;
    }
    auth.restartProduct();
  } catch {
    auth.showError(auth.GENERIC_NETWORK);
  } finally {
    auth.setBusy(submit, false);
  }
});
