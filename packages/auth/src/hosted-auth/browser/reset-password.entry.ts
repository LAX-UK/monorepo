import { isTransientFailure } from "./auth-failure.js";
import { HOSTED_AUTH_MESSAGES as msg } from "./messages.js";
import { showPasswordBreached } from "./password-breached.js";
import { resetLinkState } from "./reset-link-state.js";
import { isPasswordBreachedResponse } from "./sign-up-outcome.js";
import { hostedAuth, inputValue, submitButton } from "./window-auth.js";

const auth = hostedAuth();
const params = new URLSearchParams(window.location.search);
const token = params.get("token");
const form = document.getElementById("reset-form");
if (!(form instanceof HTMLFormElement)) {
  throw new Error("hosted reset-password form missing");
}
const newLink = document.getElementById("reset-new-link");

function offerNewLink(): void {
  if (newLink) newLink.hidden = false;
}

const linkState = resetLinkState(params);
if (linkState !== "ready") {
  auth.showError(linkState === "missing" ? msg.RESET_LINK_MISSING : msg.RESET_INVALID);
  offerNewLink();
  form.hidden = true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth.validateFields(["password"])) return;
  auth.hideStatus();
  const submit = submitButton(form, event);
  auth.setBusy(submit, true);
  try {
    const { response, data } = await auth.postJson("/api/auth/reset-password", {
      newPassword: inputValue("password"),
      token,
    });
    if (isPasswordBreachedResponse(response.status, data)) {
      showPasswordBreached(auth);
      return;
    }
    if (!response.ok) {
      if (isTransientFailure(response.status)) {
        auth.reportFailure({ response, data }, "other", msg.RESET_FAILED);
        return;
      }
      auth.showError(msg.RESET_FAILED);
      offerNewLink();
      return;
    }
    auth.restartProduct();
  } catch {
    auth.showError(auth.GENERIC_NETWORK);
  } finally {
    auth.setBusy(submit, false);
  }
});
