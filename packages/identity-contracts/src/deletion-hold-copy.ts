/**
 * What a person is told when their account deletion cannot go ahead on the day.
 *
 * This is the only place this wording lives, so it can be reviewed and edited as one piece
 * before production. Account's page, the staff view and the email all read from here.
 *
 * The default position: we keep a person's details while we still need them to complete a
 * contract with them or to deal with a legal claim, we say which obligation it is, and we say
 * when we will look again.
 */
export const DELETION_HOLD_COPY = {
  /** Heading on LAX Account's delete page and the email subject line. */
  title: "Your account deletion is on hold",
  /** Why it is held, in general terms. The specific reasons follow as a list. */
  basis:
    "We can't delete your account yet because we still need some of your details to complete a contract with you or to deal with a legal claim.",
  /** Where the page says when it will look again. The purge runs once a day. */
  recheckDaily:
    "We check again every day, and we'll delete your account as soon as nothing is open.",
  /** Introduces the list of open items. */
  reasonsIntro: "What is still open:",
  /** What the person can do. */
  resolution:
    "Once these are settled we'll delete your account automatically. You can also cancel the deletion at any time and keep your account.",
  /** Staff-facing line shown on the work item. */
  staffSummary:
    "Account deletion is on hold because the person still has open items. Resolve them, or contact the person; the deletion then runs on the next daily check.",
} as const;

const LONDON_DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "long",
});

/** "We'll check again on 4 December." */
export function deletionHoldNextCheck(nextCheckAt: Date): string {
  return `We'll check again on ${LONDON_DAY.format(nextCheckAt)}.`;
}

/** The day after `now`: the purge runs daily, so this is when a held request is looked at again. */
export function nextDeletionCheckAfter(now: Date): Date {
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}
