import { describe, expect, it, vi } from "vitest";
import { DrizzlePendingInvitationsReader } from "./drizzle-pending-invitations.reader.js";

describe("DrizzlePendingInvitationsReader.listForEmail", () => {
  it("reads and returns the inviter's name but not their user id", async () => {
    const row = {
      id: "i1",
      email: "a@example.com",
      expiresAt: new Date("2026-12-01T00:00:00Z"),
      legalEntityId: "e1",
      orgDisplayName: "Acme",
      orgSubkind: "gallery",
      inviterName: "Sam",
      roleOffered: "viewer",
    };
    const select = vi.fn().mockReturnValue({
      from: () => ({
        innerJoin: () => ({
          innerJoin: () => ({ where: () => ({ orderBy: () => Promise.resolve([row]) }) }),
        }),
      }),
    });
    const out = await new DrizzlePendingInvitationsReader({ select } as never).listForEmail(
      "a@example.com",
      new Date(),
    );
    expect(Object.keys(select.mock.calls[0]?.[0] ?? {})).not.toContain("inviterUserId");
    expect(Object.keys(out[0] ?? {})).not.toContain("inviterUserId");
    expect(out[0]?.inviterName).toBe("Sam");
  });
});
