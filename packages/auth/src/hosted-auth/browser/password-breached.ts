import { HOSTED_AUTH_MESSAGES as msg } from "./messages.js";
import type { HostedAuthApi } from "./window-auth.js";

export function showPasswordBreached(auth: HostedAuthApi, inputId = "password"): void {
  const input = document.getElementById(inputId);
  if (!(input instanceof HTMLInputElement)) {
    auth.showError(msg.PASSWORD_BREACHED);
    return;
  }
  auth.applyFieldError(input, msg.PASSWORD_BREACHED);
  auth.announce(msg.PASSWORD_BREACHED);
  input.select();
  auth.focusById(inputId);
}
