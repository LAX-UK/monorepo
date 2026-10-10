import {
  buildHostedAuthHtml,
  escapeHostedHtml,
  floatingInput,
  hostedButton,
  statusRegions,
} from "../html.js";
import { HOSTED_AUTH_POLICY } from "../policy.js";
import { type HostedAuthView, hostedAuthViewFromSearch } from "../view.js";

export { HOSTED_TWO_FACTOR_SETUP_SCRIPT } from "../scripts.js";

function setupDescription(view: HostedAuthView): string {
  return view.flow.audience === "staff"
    ? "Shop admin and other staff tools require an authenticator app on your LAX account."
    : "Add an authenticator app so signing in to your LAX account needs a second step.";
}

function continueHref(view: HostedAuthView): string {
  return view.config.authorizeResumePath ?? view.config.restartUrl;
}

export function buildHostedTwoFactorSetupHtml(
  view: HostedAuthView = hostedAuthViewFromSearch(""),
): string {
  return buildHostedAuthHtml({
    title: "Set up authenticator",
    description: setupDescription(view),
    brand: view.brand,
    config: view.config,
    body: `<div class="auth-stack">
      <form id="setup-start" class="auth-form" novalidate>
        <p class="auth-hint">Confirm your password to start. If you sign in only with Google or Apple, leave it blank.</p>
        ${floatingInput({
          id: "setup-password",
          label: "Password",
          type: "password",
          autocomplete: "current-password",
        })}
        ${hostedButton({ id: "setup-enable-btn", label: "Continue", loadingLabel: "Preparing…" })}
      </form>
      <section id="setup-enrol" class="auth-form" hidden>
        <p class="auth-hint">Scan this code with your authenticator app, or enter the key manually.</p>
        <div id="setup-qr" class="auth-qr" role="img" aria-label="QR code for your authenticator app"></div>
        <p id="setup-secret" class="auth-mono auth-hint"></p>
        <form id="setup-verify-form" novalidate>
          ${floatingInput({
            id: "setup-totp-code",
            label: "6-digit code",
            inputmode: "numeric",
            autocomplete: "one-time-code",
            minlength: HOSTED_AUTH_POLICY.otpLength,
            maxlength: HOSTED_AUTH_POLICY.otpLength,
            pattern: "[0-9]*",
          })}
          ${hostedButton({ label: "Verify and continue", loadingLabel: "Verifying…" })}
        </form>
        <div id="setup-backup" hidden>
          <p class="auth-hint">Save these backup codes somewhere safe. Each one works once if you lose your device.</p>
          <pre id="setup-backup-list" class="auth-mono" tabindex="0" aria-label="Backup codes"></pre>
          ${hostedButton({ id: "setup-copy-btn", type: "button", kind: "secondary", label: "Copy codes" })}
          ${hostedButton({ id: "setup-finish-btn", type: "button", label: "I've saved them — continue", loadingLabel: "Continuing…" })}
        </div>
      </section>
      ${statusRegions()}
    </div>`,
    scriptSrc: "/hosted-two-factor-setup.js",
  });
}

/** Shown instead of setup when the account already has an authenticator, so it is never silently replaced. */
export function buildHostedTwoFactorAlreadyEnabledHtml(
  view: HostedAuthView = hostedAuthViewFromSearch(""),
): string {
  return buildHostedAuthHtml({
    title: "Authenticator already set up",
    description:
      "Your LAX account already uses an authenticator app. If you have lost access to it, contact support and we will reset it safely.",
    brand: view.brand,
    config: view.config,
    body: `<div class="auth-form">
      <a class="btn btn-primary" href="${escapeHostedHtml(continueHref(view))}">Continue</a>
    </div>`,
  });
}
