import { HOSTED_AUTH_MESSAGES as msg } from "./messages.js";
import { hostedAuth, inputValue, submitButton } from "./window-auth.js";

const auth = hostedAuth();

function errorCode(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const code = (data as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

const disableForm = document.getElementById("manage-disable");
if (disableForm instanceof HTMLFormElement) {
  disableForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = submitButton(disableForm, event);
    auth.hideStatus();
    auth.setBusy(button, true);
    try {
      const password = inputValue("manage-password");
      const { response, data } = await auth.postJson(
        "/api/auth/two-factor/disable",
        password.length > 0 ? { password } : {},
      );
      if (response.status === 401) {
        auth.showError(msg.MFA_SESSION_EXPIRED);
        return;
      }
      if (!response.ok) {
        const code = errorCode(data);
        if (code === "TWO_FACTOR_REQUIRED_BY_POLICY") {
          auth.showError(msg.MFA_REQUIRED_BY_POLICY);
          return;
        }
        if (code === "INVALID_PASSWORD") {
          const input = document.getElementById("manage-password");
          if (input instanceof HTMLInputElement)
            auth.applyFieldError(input, msg.MFA_PASSWORD_INCORRECT);
          auth.announce(msg.MFA_PASSWORD_INCORRECT);
          auth.focusById("manage-password");
          return;
        }
        auth.showError(msg.MFA_FAILED);
        return;
      }
      disableForm.hidden = true;
      auth.showSuccess(msg.MFA_DISABLED);
      auth.focusById("manage-continue");
    } catch {
      auth.showError(auth.GENERIC_NETWORK);
    } finally {
      auth.setBusy(button, false);
    }
  });
}
