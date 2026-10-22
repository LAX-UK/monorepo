import { verificationCallbackUrl } from "./continue.js";
import { hostedAuth, inputValue, submitButton } from "./window-auth.js";

const auth = hostedAuth();
const params = new URLSearchParams(window.location.search);
const emailInput = document.getElementById("email");
const prefilledEmail = params.get("email");
if (prefilledEmail && emailInput instanceof HTMLInputElement) emailInput.value = prefilledEmail;
const form = document.getElementById("resend-form");
if (!(form instanceof HTMLFormElement)) {
  throw new Error("hosted resend-verification form missing");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth.validateFields(["email"])) return;
  auth.hideStatus();
  const submit = submitButton(form, event);
  auth.setBusy(submit, true);
  try {
    const email = inputValue("email").trim();
    const { response, data } = await auth.postJson("/api/auth/send-verification-email", {
      email,
      callbackURL: verificationCallbackUrl(window.location.origin, auth.config.loginPath),
    });
    if (!response.ok) {
      auth.reportFailure({ response, data }, "other", auth.GENERIC_NETWORK);
      return;
    }
    auth.showSuccess(auth.GENERIC_VERIFICATION);
  } catch {
    auth.showError(auth.GENERIC_NETWORK);
  } finally {
    auth.setBusy(submit, false);
  }
});
