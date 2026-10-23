import type { AccountLinksVm } from "./account-links";
import { type AccountSecurityFacts, LOW_BACKUP_CODES_THRESHOLD } from "./account-security-facts";

export type CheckupStepId = "verify-email" | "two-step" | "backup-codes" | "phone";

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

/**
 * Recommended steps the person can act on from here. A step is left out when it has no
 * destination or does not apply, so the count never promises something the page cannot deliver:
 *  - "where you're signed in" needs an Account page that does not exist yet;
 *  - backup codes appear only when two-step verification is on and the issuer reported a low
 *    count; an unknown count never prompts;
 *  - the email step does not apply to an account with no email;
 *  - adding a phone number is edited in LAX Bid, so it needs Bid to be configured.
 */
export function buildSecurityCheckup(
  facts: AccountSecurityFacts,
  links: Pick<AccountLinksVm, "verifyEmail" | "manageTwoStep" | "bidSettings">,
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
      href: links.manageTwoStep,
    });
  }

  if (links.bidSettings) {
    steps.push({
      id: "phone",
      title: "Add a phone number",
      description: facts.phoneVerified
        ? "Your phone number is verified."
        : facts.hasPhone
          ? "Verify your number so it can help you recover your account."
          : "A verified number gives you another way to recover your account.",
      done: facts.phoneVerified,
      actionLabel: facts.phoneVerified ? null : facts.hasPhone ? "Verify phone" : "Add phone",
      href: links.bidSettings.profile,
    });
  }

  const doneCount = steps.filter((step) => step.done).length;
  return {
    steps,
    doneCount,
    total: steps.length,
    complete: steps.length > 0 && doneCount === steps.length,
    summary: `${doneCount} of ${steps.length} recommended steps done`,
  };
}
