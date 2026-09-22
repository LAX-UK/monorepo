import {
  buildHostedAuthHtml,
  continuationAnchor,
  floatingInput,
  hostedButton,
  statusRegions,
} from "../html.js";
import { HOSTED_AUTH_POLICY } from "../policy.js";
import { type HostedAuthView, hostedAuthViewFromSearch } from "../view.js";

export { HOSTED_PHONE_SCRIPT } from "../scripts.js";

export function buildHostedPhoneHtml(view: HostedAuthView = hostedAuthViewFromSearch("")): string {
  return buildHostedAuthHtml({
    title: "Phone sign-in",
    description: "Enter your mobile number to receive a one-time code.",
    brand: view.brand,
    config: view.config,
    body: `<div class="auth-stack">
      <form id="phone-send-form" class="auth-form" novalidate>
        ${floatingInput({ id: "phone", label: "Phone number", type: "tel", autocomplete: "tel", inputmode: "tel" })}
        ${hostedButton({ label: "Send code", loadingLabel: "Sending…" })}
      </form>
      <form id="phone-verify-form" class="auth-form" hidden novalidate>
        ${floatingInput({
          id: "otp",
          label: "Verification code",
          inputmode: "numeric",
          autocomplete: "one-time-code",
          maxlength: HOSTED_AUTH_POLICY.otpMaxLength,
          minlength: HOSTED_AUTH_POLICY.otpLength,
          pattern: "[0-9]*",
        })}
        ${hostedButton({ label: "Verify code", loadingLabel: "Verifying…" })}
      </form>
      ${statusRegions()}
      <div class="links">${continuationAnchor("Back to sign in", "/login", view.flow)}</div>
    </div>`,
    scriptSrc: "/hosted-phone.js",
  });
}
