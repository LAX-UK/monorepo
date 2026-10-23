import type { AccountLinksVm } from "./account-links";
import { type AccountSecurityFacts, LOW_BACKUP_CODES_THRESHOLD } from "./account-security-facts";
import { ACCOUNT_ROUTES } from "./account-settings.vm";

/** Where the "Where you're signed in" list sits on the Password and security page. */
export const SIGNED_IN_DEVICES_HREF = `${ACCOUNT_ROUTES.security}#signed-in-devices`;

/** Where the backup codes section sits on the Password and security page. */
export const BACKUP_CODES_HREF = `${ACCOUNT_ROUTES.security}#backup-codes`;

export type CheckupStepId = "verify-email" | "two-step" | "backup-codes" | "sessions";

export type CheckupStepVm = {
  id: CheckupStepId;
  title: string;
  description: string;
  done: boolean;
  /** Verb for the action link; absent once the step is done. */
  actionLabel: string | null;
  href: string;
};

export type SecurityCheckupVm = {
  steps: CheckupStepVm[];
  doneCount: number;
  total: number;
  complete: boolean;
  /** "2 of 3 recommended steps done" */
  summary: string;
};

function sessionsDescription(otherSessionCount: number | null): string {
  if (otherSessionCount === null) {
    return "See which devices are signed in to your account and sign out any you don't recognise.";
  }
  if (otherSessionCount === 0) return "You're only signed in on this device.";
  return `You're also signed in on ${otherSessionCount} other ${otherSessionCount === 1 ? "device" : "devices"}. Sign out any you don't recognise.`;
}

/**
 * Recommended steps the person can act on from here. A step is left out when it has no
 * destination or does not apply, so the count never promises something the page cannot deliver:
 *  - backup codes appear only when two-step verification is on and the issuer reported a low
 *    count; an unknown count never prompts;
 *  - the email step does not apply to an account with no email;
 *  - adding a phone number is left out until Account can edit it.
 *
 * "Review where you're signed in" is done when this is the only device signed in. A person who
 * signs in on two devices on purpose keeps seeing it open: Account cannot tell a device they
 * recognise from one they do not, so it asks rather than guesses.
 */
export function buildSecurityCheckup(
  facts: AccountSecurityFacts,
  links: Pick<AccountLinksVm, "verifyEmail" | "manageTwoStep">,
): SecurityCheckupVm {
  const steps: CheckupStepVm[] = [];

  if (facts.hasEmail) {
    steps.push({
      id: "verify-email",
      title: "Verify your email",
      description: facts.emailVerified
        ? "Your email address is verified."
        : "Confirm your address so we can reach you and you can recover your account.",
      done: facts.emailVerified,
      actionLabel: facts.emailVerified ? null : "Verify email",
      href: links.verifyEmail,
    });
  }

  steps.push({
    id: "two-step",
    title: "Turn on two-step verification",
    description:
      facts.twoStep === "on"
        ? "Your account asks for a code from your authenticator app as well as your password."
        : "Ask for a code from your authenticator app as well as your password.",
    done: facts.twoStep === "on",
    actionLabel:
      facts.twoStep === "on" ? null : facts.twoStep === "off" ? "Turn on" : "Set up or review",
    href: links.manageTwoStep,
  });

  if (
    facts.twoStep === "on" &&
    facts.backupCodesRemaining !== null &&
    facts.backupCodesRemaining <= LOW_BACKUP_CODES_THRESHOLD
  ) {
    steps.push({
      id: "backup-codes",
      title: "Save new backup codes",
      description:
        facts.backupCodesRemaining === 0
          ? "You have no backup codes left. Create a new set in case you lose your phone."
          : `You have ${facts.backupCodesRemaining} backup ${facts.backupCodesRemaining === 1 ? "code" : "codes"} left. Create a new set before they run out.`,
      done: false,
      actionLabel: "Get new codes",
      href: BACKUP_CODES_HREF,
    });
  }

  steps.push({
    id: "sessions",
    title: "Review where you're signed in",
    description: sessionsDescription(facts.otherSessionCount),
    done: facts.otherSessionCount === 0,
    actionLabel: facts.otherSessionCount === 0 ? null : "Review devices",
    href: SIGNED_IN_DEVICES_HREF,
  });

  const doneCount = steps.filter((step) => step.done).length;
  return {
    steps,
    doneCount,
    total: steps.length,
    complete: steps.length > 0 && doneCount === steps.length,
    summary: `${doneCount} of ${steps.length} recommended steps done`,
  };
}
