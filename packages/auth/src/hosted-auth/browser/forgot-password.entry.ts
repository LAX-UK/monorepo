import { submitEnabled } from "./turnstile.js";
import { hostedAuth, inputValue, submitButton } from "./window-auth.js";

const auth = hostedAuth();
const form = document.getElementById("forgot-form");
if (!(form instanceof HTMLFormElement)) {
  throw new Error("hosted forgot-password form missing");
}

function bindCaptchaGate(button: HTMLButtonElement | null): void {
  auth.onTokenChange((token) => {
    if (!button || button.getAttribute("aria-busy") === "true") return;
    button.disabled = !submitEnabled({ captchaRequired: true, token });
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth.validateFields(["email"])) return;
  auth.hideStatus();
  const submit = submitButton(form, event);
  auth.setBusy(submit, true);
  try {
    const redirectTo = new URL("/reset-password", window.location.origin);
    const clientId = new URL(auth.config.loginPath, window.location.origin).searchParams.get(
      "client_id",
    );
    if (clientId) redirectTo.searchParams.set("client_id", clientId);
    const { data } = await auth.postJson("/api/auth/forget-password", {
      email: inputValue("email").trim(),
      redirectTo: redirectTo.toString(),
    });
    if (auth.isCaptchaRequired(data)) {
      bindCaptchaGate(submit);
      await auth.ensureTurnstile([submit]);
      auth.showError(auth.CAPTCHA_REQUIRED);
      return;
    }
    auth.showSuccess(auth.GENERIC_RECOVERY);
  } catch {
    auth.showError(auth.GENERIC_NETWORK);
  } finally {
    auth.setBusy(submit, false);
  }
});
