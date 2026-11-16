import { normalizeStaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../../container.js";
import { CollectionStorageAdminService } from "../../services/collection-storage/collection-storage.service.js";
import type { IAuthenticator } from "../../services/interfaces/authenticator.js";
import { InMemoryCollectionStorage } from "../../testing/in-memory-collection-storage.js";
import { createAdminRoutes } from "../admin.js";

const VENUE = "d0000000-0000-4000-8000-0000000000aa";
const NOW = new Date("2026-11-15T12:00:00Z");

const CHANGE = {
  effectiveFrom: "2026-12-01",
  reason: "New rates for December",
  freeDays: 14,
  countMode: "calendar",
  standardDailyPence: 350,
  largeDailyPence: 700,
  handlingFeePence: 0,
};

/**
 * The storage routes through the real `/admin` mount order (`createAdminRoutes`): the finance
 * group first, then the platform shell. Finance reaches the storage routes and the list of places,
 * and nothing else under Collections.
 */
function build(staffRole: string, opts: { recent?: boolean } = {}) {
  const storage = new InMemoryCollectionStorage();
  const venues = vi
    .fn()
    .mockResolvedValue([
      { venueId: VENUE, name: "Gallery", hasPlace: true, onlineBookingEnabled: true },
    ]);
  const collectionSettings = { venues, get: vi.fn().mockResolvedValue(null) };
  const container = {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      stepUp: { isRecent: vi.fn().mockResolvedValue(opts.recent ?? true) },
      collectionSettings,
      collectionStorage: new CollectionStorageAdminService({
        storage,
        places: { venues },
        now: () => NOW,
      }),
    },
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({
      id: "usr_1",
      identitySessionId: "session-1",
      role: "staff",
      staffRoles: normalizeStaffRoles([staffRole]),
      scopes: ["bid.read", "bid.write"],
    }),
  };
  const app = new Hono();
  app.route("/admin", createAdminRoutes(container, authenticator));
  return { app, storage, collectionSettings };
}

const request = (app: Hono, method: string, path: string, body?: unknown) =>
  app.request(`http://test/admin${path}`, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });

const READ = `/collections/${VENUE}/storage`;
const SCHEDULE = `/collections/${VENUE}/storage/terms`;

/** Status for reading the tab, and for scheduling a change, by staff role. */
const MATRIX: Record<string, { read: number; schedule: number }> = {
  administrator: { read: 200, schedule: 200 },
  finance: { read: 200, schedule: 200 },
  fulfilment: { read: 200, schedule: 403 },
  read_only: { read: 200, schedule: 403 },
  sales_manager: { read: 403, schedule: 403 },
  saleroom_clerk: { read: 403, schedule: 403 },
  cataloguer: { read: 403, schedule: 403 },
  specialist: { read: 403, schedule: 403 },
  client_services: { read: 403, schedule: 403 },
  compliance: { read: 403, schedule: 403 },
};

describe("collection storage through the /admin mount", () => {
  for (const [role, want] of Object.entries(MATRIX)) {
    it(`${role}: reads ${want.read}, schedules ${want.schedule}`, async () => {
      const { app, storage } = build(role);
      expect((await request(app, "GET", READ)).status).toBe(want.read);
      expect((await request(app, "POST", SCHEDULE, CHANGE)).status).toBe(want.schedule);
      expect(storage.terms).toHaveLength(want.schedule === 200 ? 1 : 0);
    });
  }

  it("asks Finance for a recent sign-in before a change, and writes nothing", async () => {
    const { app, storage } = build("finance", { recent: false });
    const res = await request(app, "POST", SCHEDULE, CHANGE);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "step_up_required" });
    expect(storage.terms).toEqual([]);
    expect((await request(app, "GET", READ)).status).toBe(200);
  });

  it("lets Finance list the places, but not open a place's hours and rules", async () => {
    const { app, collectionSettings } = build("finance");
    expect((await request(app, "GET", "/collections")).status).toBe(200);
    expect((await request(app, "GET", `/collections/${VENUE}`)).status).toBe(403);
    expect(collectionSettings.get).not.toHaveBeenCalled();
  });
});
