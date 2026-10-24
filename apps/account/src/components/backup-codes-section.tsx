import type { BackupCodesSectionVm } from "@/server/domain/account-backup-codes.vm";
import { AccountSection } from "./account-ui";
import { BackupCodesPanel } from "./backup-codes-panel.client";

type BackupCodesSectionProps = {
  section: BackupCodesSectionVm;
  /** The page this section sits on: where to return after signing in again. */
  pagePath: string;
};

/** Backup codes: how many are left, and the action that replaces them. */
export function BackupCodesSection({ section, pagePath }: BackupCodesSectionProps) {
  return (
    <AccountSection
      id="backup-codes"
      title="Backup codes"
      description="Each code works once, if you can't use your authenticator app. Creating new codes makes the old ones stop working."
    >
      <p className="text-sm font-medium text-on-surface">{section.status}</p>
      <BackupCodesPanel actionLabel={section.actionLabel} returnTo={pagePath} />
    </AccountSection>
  );
}
