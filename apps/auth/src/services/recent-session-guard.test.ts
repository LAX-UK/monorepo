import { describe, expect, it } from "vitest";
import type { IdentitySession } from "./identity-operations.service.js";
import { RecentSessionGuard } from "./recent-session-guard.js";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = new Date("2026-11-12T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

function session(over: Partial<IdentitySession> & { id: string }): IdentitySession {
  return {
    createdAt: ago(60_000),
    updatedAt: ago(60_000),
    expiresAt: new Date(NOW.getTime() + 7 * DAY),
    ipAddress: null,
    userAgent: null,
    lastPasswordAuthAt: null,
    lastActiveAt: ago(60_000),
    signedInAt: ago(60_000),
    isStaff: false,
    previousIds: [],
    country: null,
    clientIds: [],
    isCurrent: false,
    ...over,
  };
}

const guard = (sessions: IdentitySession[]) =>
  new RecentSessionGuard({ listSessions: async () => sessions }, () => NOW);

describe("RecentSessionGuard.liveSessions", () => {
  it("counts a record that is inside its limits", async () => {
    const live = await guard([session({ id: "ok" })]).liveSessions("ann");
    expect(live.map((s) => s.id)).toEqual(["ok"]);
  });

  it("drops a record whose expiry has passed", async () => {
    const live = await guard([session({ id: "x", expiresAt: ago(1) })]).liveSessions("ann");
    expect(live).toEqual([]);
  });

  it("drops a record past its absolute limit even though Better Auth has not expired it yet", async () => {
    const client = session({ id: "client", signedInAt: ago(30 * DAY) });
    const staff = session({ id: "staff", isStaff: true, signedInAt: ago(24 * HOUR) });
    expect(await guard([client, staff]).liveSessions("ann")).toEqual([]);
  });

  it("drops a record that has been idle past the person's limit", async () => {
    const client = session({ id: "client", lastActiveAt: ago(7 * DAY) });
    const staff = session({ id: "staff", isStaff: true, lastActiveAt: ago(12 * HOUR) });
    expect(await guard([client, staff]).liveSessions("ann")).toEqual([]);
  });

  it("keeps staff-length limits for staff only", async () => {
    const live = await guard([
      session({ id: "client-13h-idle", lastActiveAt: ago(13 * HOUR) }),
      session({ id: "staff-13h-idle", isStaff: true, lastActiveAt: ago(13 * HOUR) }),
    ]).liveSessions("ann");
    expect(live.map((s) => s.id)).toEqual(["client-13h-idle"]);
  });

  it("applies the same rule to findLive and findRecent", async () => {
    const over = guard([session({ id: "over", signedInAt: ago(31 * DAY) })]);
    await expect(over.findLive("ann", "over")).resolves.toBeNull();
    await expect(over.findRecent("ann", "over")).resolves.toBeNull();
  });
});
