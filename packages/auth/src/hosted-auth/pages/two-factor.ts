import { buildHostedAuthHtml, floatingInput, hostedButton, statusRegions } from "../html.js";
import { HOSTED_AUTH_POLICY } from "../policy.js";
import { type HostedAuthView, hostedAuthViewFromSearch } from "../view.js";

export { HOSTED_TWO_FACTOR_SCRIPT } from "../scripts.js";

export function buildHostedTwoFactorHtml(
  view: HostedAuthView = hostedAuthViewFromSearch(""),
): string {
  return buildHostedAuthHtml({
    title: "Two-step verification",
    description: "Enter the 6-digit code from your authenticator app.",
    brand: view.brand,
    config: view.config,
    body: `<div class="auth-stack">
      <form id="totp-form" class="auth-form" novalidate>
        ${floatingInput({
          id: "totp-code",
          label: "Authenticator code",
          inputmode: "numeric",
          autocomplete: "one-time-code",
          minlength: HOSTED_AUTH_POLICY.otpLength,
          maxlength: HOSTED_AUTH_POLICY.otpLength,
          pattern: "[0-9]*",
        })}
        <label class="field-check"><input id="trust-device" type="checkbox"> Trust this device for 30 days</label>
        ${hostedButton({ label: "Verify", loadingLabel: "Verifying…" })}
      </form>
      <p class="auth-divider"><span>or</span></p>
      <form id="backup-form" class="auth-form" novalidate>
        ${floatingInput({ id: "backup-code", label: "Backup code", autocomplete: "off" })}
        ${hostedButton({ label: "Use backup code", kind: "secondary", loadingLabel: "Verifying…" })}
      </form>
      ${statusRegions()}
    </div>`,
    scriptSrc: "/hosted-two-factor.js",
  });
}
