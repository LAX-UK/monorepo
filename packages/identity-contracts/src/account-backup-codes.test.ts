import { describe, expect, it } from "vitest";
import {
  ACCOUNT_BACKUP_CODES_REGENERATE_PATH,
  accountBackupCodesSchema,
} from "./account-backup-codes.js";

describe("account backup codes contract", () => {
  it("lives under the issuer's lax account routes", () => {
    expect(ACCOUNT_BACKUP_CODES_REGENERATE_PATH).toBe("/lax/account-backup-codes/regenerate");
  });

  it("accepts a list of codes and strips anything else the issuer might add", () => {
    expect(
      accountBackupCodesSchema.parse({ backupCodes: ["abcde-12345"], token: "secret" }),
    ).toEqual({ backupCodes: ["abcde-12345"] });
  });

  it("rejects an empty set, which would leave the person with nothing to save", () => {
    expect(accountBackupCodesSchema.safeParse({ backupCodes: [] }).success).toBe(false);
    expect(accountBackupCodesSchema.safeParse({ backupCodes: [""] }).success).toBe(false);
  });
});
