import { describe, expect, it } from "vitest";
import { buildBackupCodesSection, formatBackupCodesFile } from "./account-backup-codes.vm";

describe("buildBackupCodesSection", () => {
  it("is absent without two-step verification, including when that is unknown", () => {
    expect(buildBackupCodesSection({ twoStep: "off", backupCodesRemaining: null })).toBeNull();
    expect(buildBackupCodesSection({ twoStep: "unknown", backupCodesRemaining: null })).toBeNull();
  });

  it("states how many codes are left and when that is low", () => {
    expect(buildBackupCodesSection({ twoStep: "on", backupCodesRemaining: 8 })).toMatchObject({
      status: "8 backup codes left.",
      low: false,
    });
    expect(buildBackupCodesSection({ twoStep: "on", backupCodesRemaining: 1 })).toMatchObject({
      status: "1 backup code left.",
      low: true,
    });
    expect(buildBackupCodesSection({ twoStep: "on", backupCodesRemaining: 0 })).toMatchObject({
      status: "You have no backup codes left.",
      low: true,
    });
  });

  it("never reports an unknown count as none", () => {
    const section = buildBackupCodesSection({ twoStep: "on", backupCodesRemaining: null });
    expect(section?.status).toContain("can't tell");
    expect(section?.low).toBe(false);
  });
});

describe("formatBackupCodesFile", () => {
  it("lists every code on its own line under a dated heading", () => {
    const text = formatBackupCodesFile(
      ["abcde-12345", "fghij-67890"],
      new Date("2026-10-23T23:30:00.000Z"),
    );
    expect(text.split("\n")).toEqual([
      "LAX Account backup codes",
      "Created 24 October 2026",
      "",
      "Each code works once, in place of the code from your authenticator app.",
      "Creating new codes makes these stop working.",
      "",
      "abcde-12345",
      "fghij-67890",
      "",
    ]);
  });
});
