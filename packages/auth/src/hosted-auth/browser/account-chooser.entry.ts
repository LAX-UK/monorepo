import { HOSTED_AUTH_MESSAGES as msg } from "./messages.js";
import { asButton, hostedAuth } from "./window-auth.js";

const auth = hostedAuth();
const chooser = document.getElementById("account-chooser");
const switchButton = asButton(document.getElementById("chooser-switch"));
if (!chooser || !switchButton) {
  throw new Error("hosted account chooser missing");
}
const switchHref = chooser.getAttribute("data-switch-href") || auth.productHintLoginUrl();

switchButton.addEventListener("click", async () => {
  auth.hideStatus();
  auth.setBusy(switchButton, true);
  try {
    const { response } = await auth.postJson("/api/auth/sign-out", {});
    if (!response.ok) {
      auth.showError(msg.SIGN_OUT_FAILED);
      return;
    }
    // The session is gone, so this now renders the real sign-in or sign-up page.
    window.location.assign(switchHref);
  } catch {
    auth.showError(auth.GENERIC_NETWORK);
  } finally {
    auth.setBusy(switchButton, false);
  }
});
