import type { BackupCodesSectionVm } from "@/server/domain/account-backup-codes.vm";
import { BackupCodesPanel } from "./backup-codes-panel.client";

type BackupCodesSectionProps = {
  section: BackupCodesSectionVm;
  /** The page this section sits on: where to return after signing in again. */
  pagePath: string;
};

/** Backup codes: how many are left, and the action that replaces them. */
export function BackupCodesSection({ section, pagePath }: BackupCodesSectionProps) {
  return (
    <section aria-labelledby="backup-codes-heading" id="backup-codes" className="space-y-3">
      <div className="px-4">
        <h2
          id="backup-codes-heading"
          className="font-label text-xs font-semibold tracking-[var(--text-label-caps-tracking)] text-on-surface uppercase"
        >
          Backup codes
        </h2>
        <p className="mt-1 text-sm text-on-surface">{section.status}</p>
        <p className="mt-1 text-xs text-on-surface-variant">
          Each code works once, if you can't use your authenticator app. Creating new codes makes
          the old ones stop working.
        </p>
      </div>
      <BackupCodesPanel actionLabel={section.actionLabel} returnTo={pagePath} />
    </section>
  );
}
