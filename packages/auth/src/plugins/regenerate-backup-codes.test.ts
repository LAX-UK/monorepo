import { symmetricDecrypt } from "better-auth/crypto";
import { describe, expect, it } from "vitest";
import { createBackupCodes } from "./regenerate-backup-codes.js";

const SECRET = "test-secret-that-is-long-enough-for-better-auth";

describe("createBackupCodes", () => {
  it("makes ten codes in Better Auth's xxxxx-xxxxx shape", async () => {
    const { backupCodes } = await createBackupCodes(SECRET);
    expect(backupCodes).toHaveLength(10);
    for (const code of backupCodes) expect(code).toMatch(/^[a-zA-Z0-9]{5}-[a-zA-Z0-9]{5}$/);
    expect(new Set(backupCodes).size).toBe(10);
  });

  it("stores what Better Auth reads back: the JSON list, encrypted under the server secret", async () => {
    const { backupCodes, encryptedBackupCodes } = await createBackupCodes(SECRET);
    expect(encryptedBackupCodes).not.toContain(backupCodes[0]);
    const decrypted = await symmetricDecrypt({ key: SECRET, data: encryptedBackupCodes });
    expect(JSON.parse(decrypted)).toEqual(backupCodes);
  });

  it("makes a different set every time", async () => {
    const first = await createBackupCodes(SECRET);
    const second = await createBackupCodes(SECRET);
    expect(second.backupCodes).not.toEqual(first.backupCodes);
  });
});
