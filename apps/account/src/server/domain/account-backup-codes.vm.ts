import { type AccountSecurityFacts, LOW_BACKUP_CODES_THRESHOLD } from "./account-security-facts";

export type BackupCodesSectionVm = {
  /** "7 backup codes left", or plain words when the count is low or unknown. */
  status: string;
  /** True at or below the threshold where Account suggests a fresh set. */
  low: boolean;
  actionLabel: string;
};

/**
 * Backup codes only exist with two-step verification, so the section is absent otherwise. An
 * unknown count (the issuer could not be asked) is said plainly and never shown as zero.
 */
export function buildBackupCodesSection(
  facts: Pick<AccountSecurityFacts, "twoStep" | "backupCodesRemaining">,
): BackupCodesSectionVm | null {
  if (facts.twoStep !== "on") return null;
  const remaining = facts.backupCodesRemaining;
  if (remaining === null) {
    return {
      status: "We can't tell how many backup codes you have left right now.",
      low: false,
      actionLabel: "Create new backup codes",
    };
  }
  return {
    status:
      remaining === 0
        ? "You have no backup codes left."
        : `${remaining} backup ${remaining === 1 ? "code" : "codes"} left.`,
    low: remaining <= LOW_BACKUP_CODES_THRESHOLD,
    actionLabel: "Create new backup codes",
  };
}

/** Copy for the confirmation that precedes regenerating: it names what stops working. */
export const REGENERATE_BACKUP_CODES_CONFIRM = {
  title: "Create new backup codes?",
  body: "Your current backup codes will stop working straight away. You'll see the new ones once, so be ready to save them.",
  confirmLabel: "Create new codes",
} as const;

export const BACKUP_CODES_SAVE_NOTICE =
  "Save these now. We won't show them again, and your old backup codes no longer work.";

export const BACKUP_CODES_FILENAME = "lax-account-backup-codes.txt";

/** The text file offered for download: the codes with enough context to be useful in a drawer. */
export function formatBackupCodesFile(codes: readonly string[], createdAt: Date): string {
  const date = createdAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
  return [
    "LAX Account backup codes",
    `Created ${date}`,
    "",
    "Each code works once, in place of the code from your authenticator app.",
    "Creating new codes makes these stop working.",
    "",
    ...codes,
    "",
  ].join("\n");
}
