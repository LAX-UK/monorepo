import { type UserStaffRole, activeStaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import {
  BidContextEnrichedAuthenticator,
  IdentityPrincipalAuthenticator,
} from "../infrastructure/bid-context-enriched-authenticator.js";
import { DrizzleBidUserContextLoader } from "../infrastructure/drizzle-bid-user-context.loader.js";
import { createRequireAuth } from "./require-auth.js";
import { createRequireCapability, requirePlatformShell } from "./require-capability.js";
import { requireSuperAdminStaffRole } from "./require-staff-role.js";

const NOW = new Date("2026-10-28T12:00:00.000Z");
const PAST = new Date("2026-01-01T00:00:00.000Z");

type Held = { role: UserStaffRole; endsAt: Date | null };

/** The real session path: identity, then the Bid profile and the roles in force, once a request. */
function appFor(held: Held[]) {
  const profile = {
    role: "staff",
    suspendedAt: null,
    identityDisabledAt: null,
    mergedIntoSubjectId: null,
  };
  const db = {
    select: vi.fn(() => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([profile]) }) }),
    })),
  };
  const assignments = held.map((h) => ({ ...h, startsAt: PAST }));
  const reader = { listActiveRoles: vi.fn(async () => activeStaffRoles(assignments, NOW)) };
  const identity = {
    getSessionUser: async () => ({
      id: "staff-1",
      role: "client" as const,
      staffRoles: [],
      scopes: ["bid.read", "bid.write"],
    }),
  };
  const authenticator = new BidContextEnrichedAuthenticator(
    new IdentityPrincipalAuthenticator(identity),
    new DrizzleBidUserContextLoader(db as never, reader, () => NOW),
  );
  const app = new Hono();
  app.use("*", createRequireAuth(authenticator));
  app.get("/bids", createRequireCapability("bids.read"), (c) => c.json({ ok: true }));
  app.get("/appraise", createRequireCapability("specialist.appraise"), (c) => c.json({ ok: true }));
  app.get("/catalogue", createRequireCapability("catalogue.write"), (c) => c.json({ ok: true }));
  app.get("/place-bid", createRequireCapability("bid.place"), (c) => c.json({ ok: true }));
  app.get("/platform", requirePlatformShell, (c) => c.json({ ok: true }));
  app.get("/queues", requireSuperAdminStaffRole, (c) => c.json({ ok: true }));
  return { app, reader };
}

describe("staff permissions in a request come from every role in force", () => {
  it("allows what any held role allows and refuses the rest", async () => {
    const { app, reader } = appFor([
      { role: "specialist", endsAt: null },
      { role: "client_services", endsAt: null },
    ]);

    expect((await app.request("/bids")).status).toBe(200);
    expect((await app.request("/appraise")).status).toBe(200);
    expect((await app.request("/catalogue")).status).toBe(403);
    expect(reader.listActiveRoles).toHaveBeenCalledTimes(3);
  });

  it("drops a role once it has ended", async () => {
    const { app } = appFor([
      { role: "specialist", endsAt: null },
      { role: "cataloguer", endsAt: PAST },
    ]);

    expect((await app.request("/catalogue")).status).toBe(403);
    expect((await app.request("/appraise")).status).toBe(200);
  });

  it("never lets staff act as clients", async () => {
    const { app } = appFor([{ role: "administrator", endsAt: null }]);

    expect((await app.request("/place-bid")).status).toBe(403);
  });

  it("opens the platform shell for finance staff who hold another role, not for finance alone", async () => {
    expect(
      (await appFor([{ role: "finance", endsAt: null }]).app.request("/platform")).status,
    ).toBe(403);
    expect(
      (
        await appFor([
          { role: "finance", endsAt: null },
          { role: "sales_manager", endsAt: null },
        ]).app.request("/platform")
      ).status,
    ).toBe(200);
  });

  it("keeps engineering tools to administrators", async () => {
    expect(
      (await appFor([{ role: "administrator", endsAt: null }]).app.request("/queues")).status,
    ).toBe(200);
    expect(
      (await appFor([{ role: "specialist", endsAt: null }]).app.request("/queues")).status,
    ).toBe(403);
  });
});
