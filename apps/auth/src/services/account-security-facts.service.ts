import type { AccountSecurityFactsResponse } from "@auction/identity-contracts";

export type AccountSecurityBaseFacts = { twoFactorEnabled: boolean };

export type AccountSecurityFactsPorts = {
  /** Null when the subject no longer exists. */
  readBaseFacts(subjectId: string): Promise<AccountSecurityBaseFacts | null>;
  /**
   * Number of unused backup codes, decrypted and counted inside the issuer. Implementations
   * must never return or log the codes themselves. Throws when the codes cannot be read.
   */
  countBackupCodes(subjectId: string): Promise<number>;
};

/**
 * Builds the security facts LAX Account shows. A failure to count backup codes degrades that
 * one fact to unknown (null) instead of failing the whole read: the enrolment fact is still
 * true and useful, and "unknown" never reads as "none left".
 */
export class AccountSecurityFactsService {
  constructor(
    private readonly ports: AccountSecurityFactsPorts,
    private readonly onCountFailure?: (error: unknown) => void,
  ) {}

  async read(subjectId: string): Promise<AccountSecurityFactsResponse | null> {
    const base = await this.ports.readBaseFacts(subjectId);
    if (!base) return null;
    if (!base.twoFactorEnabled) return { ...base, backupCodesRemaining: null };
    try {
      return { ...base, backupCodesRemaining: await this.ports.countBackupCodes(subjectId) };
    } catch (error) {
      this.onCountFailure?.(error);
      return { ...base, backupCodesRemaining: null };
    }
  }
}
