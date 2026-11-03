import { describe, expect, it } from "vitest";
import {
  ACCOUNT_DELETION_PENDING_CODE,
  accountDeletionDueAt,
  accountDeletionPendingBody,
  accountDeletionPendingMessage,
} from "./deletion-pending.js";

describe("account deletion pending", () => {
  it("ends the grace period 30 days after the request", () => {
    expect(accountDeletionDueAt("2026-11-02T10:00:00Z").toISOString()).toBe(
      "2026-12-02T10:00:00.000Z",
    );
  });

  it("tells the person the day they will be deleted and what to do", () => {
    expect(accountDeletionPendingMessage("2026-11-02T10:00:00Z")).toBe(
      "Your account is due to be deleted on 2 December. Cancel deletion to continue.",
    );
  });

  it("reads the day in London, not UTC", () => {
    // 23:30 UTC on 1 June is 00:30 on 2 June in London (BST), so the due day is 2 July.
    expect(accountDeletionPendingMessage("2026-06-01T23:30:00Z")).toContain("2 July");
  });

  it("returns a body products can send with a 403", () => {
    const body = accountDeletionPendingBody("2026-11-02T10:00:00Z");
    expect(body.code).toBe(ACCOUNT_DELETION_PENDING_CODE);
    expect(body.deletionDueAt).toBe("2026-12-02T10:00:00.000Z");
  });
});
