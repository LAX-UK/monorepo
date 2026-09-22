import { HOSTED_AUTH_MESSAGES as msg } from "./messages.js";
import { asButton, hostedAuth } from "./window-auth.js";

const auth = hostedAuth();
const form = document.getElementById("oidc-consent");
if (!(form instanceof HTMLFormElement)) {
  throw new Error("hosted consent form missing");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const accept = event.submitter instanceof HTMLButtonElement && event.submitter.value === "accept";
  const buttons = [...form.querySelectorAll("button")].map((node) => asButton(node));
  for (const button of buttons) auth.setBusy(button, true);
  try {
    const consentCode = document.getElementById("consent-code");
    const response = await fetch("/api/auth/oauth2/consent", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accept,
        consent_code: consentCode instanceof HTMLInputElement ? consentCode.value : "",
      }),
    });
    const result: unknown = await response.json().catch(() => null);
    if (
      response.ok &&
      result &&
      typeof result === "object" &&
      "redirectURI" in result &&
      typeof result.redirectURI === "string" &&
      auth.isAllowedContinueUrl(result.redirectURI)
    ) {
      window.location.assign(result.redirectURI);
      return;
    }
    auth.showError(msg.CONSENT_FAILED);
  } catch {
    auth.showError(msg.CONSENT_FAILED);
  } finally {
    for (const button of buttons) auth.setBusy(button, false);
  }
});
