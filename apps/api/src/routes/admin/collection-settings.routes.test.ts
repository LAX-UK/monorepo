import type { StaffRoles } from "@auction/types";
import { userStaffRoles } from "@auction/types";
import { Hono } from "hono";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { settingsError } from "../../services/collection-settings/collection-settings.errors.js";
import { attachAdminCollectionSettingsRoutes } from "./collection-settings.routes.js";

const VENUE = "d0000000-0000-4000-8000-0000000000aa";
const EXCEPTION = "d0000000-0000-4000-8000-0000000000b1";

function createApp(staffRoles: StaffRoles | undefined) {
  const collectionSettings = {
    venues: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(ok({ venueId: VENUE })),
    save: vi.fn().mockResolvedValue(ok({ cancelled: 0 })),
    addException: vi.fn().mockResolvedValue(ok({ cancelled: 0 })),
    removeException: vi.fn().mockResolvedValue(ok({ cancelled: 0 })),
  };
  const app = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
  }>();
  app.use("*", async (c, next) => {
    c.set("userId", "staff-1");
    c.set("userRole", "staff");
    c.set("userStaffRoles", staffRoles);
    await next();
  });
  attachAdminCollectionSettingsRoutes(app as never, { admin: { collectionSettings } } as never);
  return { app, collectionSettings };
}

const send = (method: string, body?: unknown) => ({
  method,
  ...(body !== undefined
    ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : {}),
});

const SAVE = {
  version: "2026-11-01T09:00:00.000Z",
  onlineBookingEnabled: true,
  visitMinutes: 30,
  placesPerSlot: 2,
  noticeCutoffLocal: "16:00",
  noticeWorkingDays: 1,
  windowDays: 28,
  closeOnSaleDays: true,
  undoHandOverMinutes: 15,
  freeStorageDays: null,
  bookingEmail: null,
  hours: [{ weekday: 1, opensLocal: "10:00", closesLocal: "19:00" }],
};
const CLOSURE = {
  kind: "closure",
  startsOn: "2026-12-24",
  endsOn: "2026-12-24",
  opensLocal: null,
  closesLocal: null,
};

const reads: [string, string][] = [
  ["GET", "/collections"],
  ["GET", `/collections/${VENUE}`],
];
const writes: [string, string, unknown][] = [
  ["PUT", `/collections/${VENUE}`, SAVE],
  ["POST", `/collections/${VENUE}/exceptions`, CLOSURE],
  ["POST", `/collections/${VENUE}/exceptions/${EXCEPTION}/remove`, {}],
];

describe("collection settings access", () => {
  it.each(userStaffRoles)(
    "%s: reads and changes follow the Collections permission",
    async (role) => {
      const canChange = role === "administrator" || role === "fulfilment";
      const canRead = canChange || role === "read_only";
      for (const [method, path] of reads) {
        const { app } = createApp([role]);
        const res = await app.request(`http://test${path}`, send(method));
        expect(res.status === 403, `${role} ${method} ${path}`).toBe(!canRead);
      }
      for (const [method, path, body] of writes) {
        const { app, collectionSettings } = createApp([role]);
        const res = await app.request(`http://test${path}`, send(method, body));
        expect(res.status === 403, `${role} ${method} ${path}`).toBe(!canChange);
        if (!canChange) {
          expect(collectionSettings.save).not.toHaveBeenCalled();
          expect(collectionSettings.addException).not.toHaveBeenCalled();
          expect(collectionSettings.removeException).not.toHaveBeenCalled();
        }
      }
    },
  );
});

describe("collection settings routes", () => {
  it("answers a read without caching it", async () => {
    const { app } = createApp(["fulfilment"]);
    const res = await app.request(`http://test/collections/${VENUE}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ data: { venueId: VENUE } });
  });

  it("passes the acting staff member and the body to a save", async () => {
    const { app, collectionSettings } = createApp(["fulfilment"]);
    const res = await app.request(`http://test/collections/${VENUE}`, send("PUT", SAVE));
    expect(res.status).toBe(200);
    expect(collectionSettings.save).toHaveBeenCalledWith({ userId: "staff-1" }, VENUE, SAVE);
  });

  it("keeps a refusal's status and code, and the bookings it affects", async () => {
    const { app, collectionSettings } = createApp(["fulfilment"]);
    const affected = [
      { bookingId: "b1", reference: "COL-1", start: "x", end: "y", reason: "closed" },
    ];
    collectionSettings.addException.mockResolvedValue(
      err(settingsError("bookings_affected", { affected: affected as never })),
    );
    const res = await app.request(
      `http://test/collections/${VENUE}/exceptions`,
      send("POST", CLOSURE),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "bookings_affected", affected });
  });

  it("says which fields cannot be saved", async () => {
    const { app, collectionSettings } = createApp(["fulfilment"]);
    collectionSettings.save.mockResolvedValue(
      err(settingsError("settings_invalid", { issues: { rules: ["visit_minutes"] } })),
    );
    const res = await app.request(`http://test/collections/${VENUE}`, send("PUT", SAVE));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      error: "settings_invalid",
      issues: { rules: ["visit_minutes"] },
    });
  });

  it("rejects a body that is not the right shape before the service sees it", async () => {
    const { app, collectionSettings } = createApp(["fulfilment"]);
    const res = await app.request(
      `http://test/collections/${VENUE}`,
      send("PUT", { ...SAVE, visitMinutes: "thirty", extra: 1 }),
    );
    expect(res.status).toBe(400);
    expect(collectionSettings.save).not.toHaveBeenCalled();
  });

  it("removes a closure by its id", async () => {
    const { app, collectionSettings } = createApp(["fulfilment"]);
    const res = await app.request(
      `http://test/collections/${VENUE}/exceptions/${EXCEPTION}/remove`,
      send("POST", { affectedBookings: { choice: "keep", bookingIds: [] } }),
    );
    expect(res.status).toBe(200);
    expect(collectionSettings.removeException).toHaveBeenCalledWith(
      { userId: "staff-1" },
      VENUE,
      EXCEPTION,
      { affectedBookings: { choice: "keep", bookingIds: [] } },
    );
  });
});
