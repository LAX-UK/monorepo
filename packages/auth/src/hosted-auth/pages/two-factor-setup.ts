import {
  buildHostedAuthHtml,
  escapeHostedHtml,
  floatingInput,
  hostedButton,
  statusRegions,
} from "../html.js";
import { HOSTED_AUTH_POLICY } from "../policy.js";
import { type HostedAuthView, hostedAuthViewFromSearch } from "../view.js";

export { HOSTED_TWO_FACTOR_SETUP_SCRIPT, HOSTED_TWO_FACTOR_MANAGE_SCRIPT } from "../scripts.js";

export type TwoFactorSetupRequiredBy = "staff" | "org";

export function parseTwoFactorSetupRequiredBy(
  value: string | null,
): TwoFactorSetupRequiredBy | null {
  return value === "staff" || value === "org" ? value : null;
}

function setupDescription(
  view: HostedAuthView,
  requiredBy: TwoFactorSetupRequiredBy | null,
): string {
  if (requiredBy === "staff") {
    return "LAX requires two-step verification for staff accounts. Add an authenticator app to continue.";
  }
  if (requiredBy === "org") {
    return "Your organisation requires two-step verification. Add an authenticator app to continue.";
  }
  return view.flow.audience === "staff"
    ? "Shop admin and other staff tools require an authenticator app on your LAX account."
    : "Add an authenticator app so signing in to your LAX account needs a second step.";
}

function continueHref(view: HostedAuthView): string {
  return view.config.authorizeResumePath ?? view.config.restartUrl;
}

export function buildHostedTwoFactorSetupHtml(
  view: HostedAuthView = hostedAuthViewFromSearch(""),
  requiredBy: TwoFactorSetupRequiredBy | null = null,
): string {
  return buildHostedAuthHtml({
    title: "Set up authenticator",
    description: setupDescription(view, requiredBy),
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

function requiredByNotice(requiredBy: readonly TwoFactorSetupRequiredBy[]): string {
  const staff = requiredBy.includes("staff");
  const org = requiredBy.includes("org");
  const who =
    staff && org
      ? "LAX staff policy and your organisation"
      : staff
        ? "LAX staff policy"
        : "your organisation";
  return `<p class="auth-hint" id="manage-required-by"><strong>Required by ${who}.</strong> It can't be turned off while this applies.</p>`;
}

/**
 * Manage page for an account that already has an authenticator. It never re-enrols (that
 * would silently replace the working secret) and hides "Turn off" while a policy requires it.
 */
export function buildHostedTwoFactorManageHtml(
  view: HostedAuthView = hostedAuthViewFromSearch(""),
  requiredBy: readonly TwoFactorSetupRequiredBy[] = [],
): string {
  const turnOff =
    requiredBy.length > 0
      ? requiredByNotice(requiredBy)
      : `<form id="manage-disable" class="auth-form" novalidate>
        <p class="auth-hint">To turn it off, confirm your password. If you sign in only with Google or Apple, leave it blank.</p>
        ${floatingInput({
          id: "manage-password",
          label: "Password",
          type: "password",
          autocomplete: "current-password",
        })}
        ${hostedButton({ kind: "secondary", label: "Turn off two-step verification", loadingLabel: "Turning off…" })}
      </form>`;
  return buildHostedAuthHtml({
    title: "Two-step verification is on",
    description:
      "You'll be asked for a code from your authenticator app when you sign in. Lost your device? Use a backup code, or contact LAX support to reset it safely.",
    brand: view.brand,
    config: view.config,
    body: `<div class="auth-stack">
      ${turnOff}
      <div class="auth-form">
        <a class="btn btn-primary" id="manage-continue" href="${escapeHostedHtml(continueHref(view))}">Done</a>
      </div>
      ${statusRegions()}
    </div>`,
    ...(requiredBy.length > 0 ? {} : { scriptSrc: "/hosted-two-factor-manage.js" }),
  });
}
