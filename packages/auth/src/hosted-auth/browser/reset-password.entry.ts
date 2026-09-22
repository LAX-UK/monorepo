import { HOSTED_AUTH_MESSAGES as msg } from "./messages.js";
import { hostedAuth, inputValue, submitButton } from "./window-auth.js";

const auth = hostedAuth();
const params = new URLSearchParams(window.location.search);
const token = params.get("token");
const form = document.getElementById("reset-form");
if (!(form instanceof HTMLFormElement)) {
  throw new Error("hosted reset-password form missing");
}
if (!token) {
  auth.showError(msg.RESET_INVALID);
  form.hidden = true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth.validateFields(["password"])) return;
  auth.hideStatus();
  const submit = submitButton(form, event);
  auth.setBusy(submit, true);
  try {
    const { response } = await auth.postJson("/api/auth/reset-password", {
      newPassword: inputValue("password"),
      token,
    });
    if (!response.ok) {
      auth.showError(msg.RESET_FAILED);
      return;
    }
    auth.restartProduct();
  } catch {
    auth.showError(auth.GENERIC_NETWORK);
  } finally {
    auth.setBusy(submit, false);
  }
});
