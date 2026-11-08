import { hostedAuth, submitButton } from "./window-auth.js";

const auth = hostedAuth();
const form = document.getElementById("password-link-form");
if (!(form instanceof HTMLFormElement)) {
  throw new Error("hosted set-password form missing");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  auth.hideStatus();
  const submit = submitButton(form, event);
  auth.setBusy(submit, true);
  try {
    const redirectTo = new URL("/reset-password", window.location.origin);
    const clientId = new URL(auth.config.loginPath, window.location.origin).searchParams.get(
      "client_id",
    );
    if (clientId) redirectTo.searchParams.set("client_id", clientId);
    const { response, data } = await auth.postJson("/api/auth/request-password-reset", {
      email: form.dataset.email ?? "",
      redirectTo: redirectTo.toString(),
    });
    if (!response.ok) {
      auth.reportFailure({ response, data }, "other", auth.GENERIC_NETWORK);
      return;
    }
    auth.showSuccess(
      "We've emailed you a link. Open it to set your password, then sign in and add an authenticator app.",
    );
  } catch {
    auth.showError(auth.GENERIC_NETWORK);
  } finally {
    auth.setBusy(submit, false);
  }
});
