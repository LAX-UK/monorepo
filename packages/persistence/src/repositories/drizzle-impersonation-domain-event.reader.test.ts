import { describe, expect, it, vi } from "vitest";
import { DrizzleImpersonationDomainEventReader } from "./drizzle-impersonation-domain-event.reader.js";

describe("DrizzleImpersonationDomainEventReader", () => {
  it("findStartedEvent returns acting legal entity when a started event exists", async () => {
    const limit = vi.fn().mockResolvedValue([{ actingLegalEntityId: "entity-1" }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as never;

    const reader = new DrizzleImpersonationDomainEventReader(db);
    const started = await reader.findStartedEvent({
      sessionId: "session-1",
      actorUserId: "staff-1",
    });

    expect(started).toEqual({ actingLegalEntityId: "entity-1" });
  });

  it("hasEndedEvent returns true when an ended event exists", async () => {
    const limit = vi.fn().mockResolvedValue([{ id: 42 }]);
    const where = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ where });
    const select = vi.fn().mockReturnValue({ from });
    const db = { select } as never;

    const reader = new DrizzleImpersonationDomainEventReader(db);
    const ended = await reader.hasEndedEvent("session-1");

    expect(ended).toBe(true);
  });
});
