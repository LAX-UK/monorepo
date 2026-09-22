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
    const verifyCallback = new URL("/verify-email", window.location.origin);
    const clientId = new URL(auth.config.loginPath, window.location.origin).searchParams.get(
      "client_id",
    );
    if (clientId) verifyCallback.searchParams.set("client_id", clientId);
    await auth.postJson("/api/auth/send-verification-email", {
      email,
      callbackURL: verifyCallback.toString(),
    });
    auth.showSuccess(auth.GENERIC_VERIFICATION);
  } catch {
    auth.showError(auth.GENERIC_NETWORK);
  } finally {
    auth.setBusy(submit, false);
  }
});
