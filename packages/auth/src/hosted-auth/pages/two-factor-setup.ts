import { HOSTED_COPY } from "../copy.js";
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

/** Room for "123 456" as an authenticator app shows it; the script strips the space as it lands. */
const PASTED_CODE_MAXLENGTH = 12;

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
    return `LAX requires ${HOSTED_COPY.twoStep.name} for staff accounts. Add an ${HOSTED_COPY.twoStep.app} to continue.`;
  }
  if (requiredBy === "org") {
    return `Your organisation requires ${HOSTED_COPY.twoStep.name}. Add an ${HOSTED_COPY.twoStep.app} to continue.`;
  }
  return view.flow.audience === "staff"
    ? `LAX Shop Admin and other staff tools require ${HOSTED_COPY.twoStep.name} on your ${HOSTED_COPY.accountName}.`
    : `Add an ${HOSTED_COPY.twoStep.app} so signing in to your ${HOSTED_COPY.accountName} needs a second step.`;
}

/**
 * Better Auth lets an account with no password enrol with this field blank, but the authorise
 * gate only sends accounts that have a password here when a policy demands two-step
 * verification (a bare session proves nothing a stolen one could not), so the copy says so.
 */
function passwordHint(requiredBy: TwoFactorSetupRequiredBy | null): string {
  if (requiredBy) {
    return "Confirm your password to start. This requirement needs an account with a password, so if you sign in only with Google or Apple, add a password first.";
  }
  return "Confirm your password to start. If you sign in only with Google or Apple and have no password, leave it blank.";
}

function continueHref(view: HostedAuthView): string {
  return view.config.authorizeResumePath ?? view.config.restartUrl;
}

export function buildHostedTwoFactorSetupHtml(
  view: HostedAuthView = hostedAuthViewFromSearch(""),
  requiredBy: TwoFactorSetupRequiredBy | null = null,
): string {
  return buildHostedAuthHtml({
    title: `Set up ${HOSTED_COPY.twoStep.name}`,
    description: setupDescription(view, requiredBy),
    brand: view.brand,
    config: view.config,
    body: `<div class="auth-stack">
      <form id="setup-start" class="auth-form" novalidate>
        <p class="auth-hint">${escapeHostedHtml(passwordHint(requiredBy))}</p>
        ${floatingInput({
          id: "setup-password",
          label: "Password",
          type: "password",
          autocomplete: "current-password",
          required: false,
        })}
        ${hostedButton({ id: "setup-enable-btn", label: "Continue", loadingLabel: "Preparing…" })}
      </form>
      <section id="setup-enrol" class="auth-form" hidden>
        <p class="auth-hint">Scan this code with your ${HOSTED_COPY.twoStep.app}, or enter the key manually.</p>
        <div id="setup-qr" class="auth-qr" role="img" aria-label="QR code for your ${HOSTED_COPY.twoStep.app}"></div>
        <p id="setup-secret" class="auth-mono auth-hint"></p>
        <form id="setup-verify-form" novalidate>
          ${floatingInput({
            id: "setup-totp-code",
            label: HOSTED_COPY.twoStep.codeLabel,
            inputmode: "numeric",
            autocomplete: "one-time-code",
            minlength: HOSTED_AUTH_POLICY.otpLength,
            maxlength: PASTED_CODE_MAXLENGTH,
            pattern: `[0-9]{${String(HOSTED_AUTH_POLICY.otpLength)}}`,
            exactEntry: true,
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
 * Manage page for an account that already has two-step verification. It never re-enrols (that
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
    title: `${HOSTED_COPY.twoStep.title} is on`,
    description: `You'll be asked for a code from your ${HOSTED_COPY.twoStep.app} when you sign in. Lost your device? Use a backup code, or contact LAX support to reset it safely.`,
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
