import type { AccountLinksVm } from "./account-links";
import type { AccountSecurityFacts } from "./account-security-facts";

export type CheckupStepId = "verify-email" | "two-step" | "phone";

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
 *  - backup codes and "where you're signed in" need Account pages that do not exist yet;
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
    description: facts.twoStepConfirmed
      ? "You completed a second step to sign in."
      : "Ask for a code from your authenticator app as well as your password.",
    done: facts.twoStepConfirmed,
    actionLabel: facts.twoStepConfirmed ? null : "Set up or review",
    href: links.manageTwoStep,
  });

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
