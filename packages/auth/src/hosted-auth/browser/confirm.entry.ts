import { createCaptchaGate } from "./captcha-gate.js";
import { HOSTED_AUTH_MESSAGES as msg } from "./messages.js";
import { bindPasskeySignIn } from "./passkey-sign-in-dom.js";
import { bindSocialCallbackError, bindSocialSignIn } from "./social-sign-in.js";
import { asButton, hostedAuth, inputValue, submitButton } from "./window-auth.js";

/**
 * "Confirm it's you": the person is signed in and is asked to sign in again before a sensitive
 * change. The email is the signed-in person's own and is never typed here, so the password and
 * the passkey can only confirm them. Passkey, Google and Apple go through the same shared steps
 * as the sign-in page.
 */
const auth = hostedAuth();
const captcha = createCaptchaGate(auth);
const root = document.getElementById("confirm-root");
const email = root?.getAttribute("data-email") ?? "";
bindSocialCallbackError(auth);
bindSocialSignIn(auth);
bindPasskeySignIn(auth);

const form = document.getElementById("confirm-form");
if (form instanceof HTMLFormElement) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!auth.validateFields(["password"])) return;
    auth.hideStatus();
    const submit = submitButton(form, event);
    auth.setBusy(submit, true);
    try {
      const { response, data } = await auth.postJson("/api/auth/sign-in/email", {
        email,
        password: inputValue("password"),
      });
      if (await captcha.handle(data, [submit])) return;
      if (response.status === 400 || response.status === 401) {
        // The email is the person's own, so only the password can be wrong.
        auth.showError(msg.PASSWORD_INCORRECT);
        return;
      }
      if (!response.ok) {
        auth.reportFailure({ response, data }, "sign-in", auth.GENERIC_NETWORK);
        return;
      }
      auth.continueAfterAuth(data);
    } catch {
      auth.showError(auth.GENERIC_NETWORK);
    } finally {
      auth.setBusy(submit, false);
    }
  });
}

const notYou = asButton(document.getElementById("confirm-not-you"));
notYou?.addEventListener("click", async () => {
  auth.hideStatus();
  auth.setBusy(notYou, true);
  try {
    const { response } = await auth.postJson("/api/auth/sign-out", {});
    if (!response.ok) {
      auth.showError(msg.SIGN_OUT_FAILED);
      return;
    }
    // The session is gone, so the same address now shows the ordinary sign-in page.
    window.location.reload();
  } catch {
    auth.showError(auth.GENERIC_NETWORK);
  } finally {
    auth.setBusy(notYou, false);
  }
});
