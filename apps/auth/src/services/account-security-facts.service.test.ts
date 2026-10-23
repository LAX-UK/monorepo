import { describe, expect, it, vi } from "vitest";
import { AccountSecurityFactsService } from "./account-security-facts.service.js";

const SUBJECT = "11111111-1111-4111-8111-111111111111";

function build(input: {
  base: { twoFactorEnabled: boolean } | null;
  count?: () => Promise<number>;
  onCountFailure?: (error: unknown) => void;
}) {
  const countBackupCodes = vi.fn(input.count ?? (async () => 7));
  return {
    countBackupCodes,
    service: new AccountSecurityFactsService(
      { readBaseFacts: async () => input.base, countBackupCodes },
      input.onCountFailure,
    ),
  };
}

describe("AccountSecurityFactsService", () => {
  it("returns null for an unknown subject", async () => {
    expect(await build({ base: null }).service.read(SUBJECT)).toBeNull();
  });

  it("does not look at backup codes when two-step verification is off", async () => {
    const { service, countBackupCodes } = build({
      base: { twoFactorEnabled: false },
    });
    expect(await service.read(SUBJECT)).toEqual({
      twoFactorEnabled: false,
      backupCodesRemaining: null,
    });
    expect(countBackupCodes).not.toHaveBeenCalled();
  });

  it("counts backup codes when enrolled", async () => {
    const { service } = build({ base: { twoFactorEnabled: true } });
    expect(await service.read(SUBJECT)).toEqual({
      twoFactorEnabled: true,
      backupCodesRemaining: 7,
    });
  });

  it("reports an unknown count, not zero, when the codes cannot be read", async () => {
    const onCountFailure = vi.fn();
    const { service } = build({
      base: { twoFactorEnabled: true },
      count: async () => {
        throw new Error("decrypt failed");
      },
      onCountFailure,
    });
    expect(await service.read(SUBJECT)).toEqual({
      twoFactorEnabled: true,
      backupCodesRemaining: null,
    });
    expect(onCountFailure).toHaveBeenCalledTimes(1);
  });
});
