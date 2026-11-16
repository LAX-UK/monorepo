import type { StaffRoles } from "@auction/types";
import { userStaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createDangerousStaffActionGate } from "../../middleware/dangerous-staff-action-gate.js";
import { createRequireRecentStaffAuth } from "../../middleware/require-recent-staff-auth.js";
import { CollectionStorageFollowUpService } from "../../services/collection-storage/collection-storage-follow-up.service.js";
import { InMemoryStorageFollowUp, waitingLot } from "../../testing/in-memory-storage-follow-up.js";
import { attachAdminCollectionStorageRoutes } from "./collection-storage.routes.js";

const VENUE = "d0000000-0000-4000-8000-0000000000aa";
const LOT = "e0000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-11-16T12:00:00Z");

type Vars = {
  userId?: string;
  userRole?: string;
  userStaffRoles?: StaffRoles | undefined;
  identitySessionId?: string;
};

/** The follow-up routes as the API mounts them under /admin, behind the step-up gate. */
function createApp(staffRoles: StaffRoles | undefined, opts: { recentSignIn?: boolean } = {}) {
  const storage = new InMemoryStorageFollowUp();
  storage.lots.set(VENUE, [waitingLot({ lotId: LOT })]);
  const venues = vi
    .fn()
    .mockResolvedValue([
      { venueId: VENUE, name: "Gallery", hasPlace: true, onlineBookingEnabled: true },
    ]);
  const collectionStorageFollowUp = new CollectionStorageFollowUpService({
    storage,
    places: { venues },
    now: () => NOW,
  });
  const isRecent = vi.fn().mockResolvedValue(opts.recentSignIn ?? true);
  const admin = new Hono<{ Variables: Vars }>();
  admin.use("*", createDangerousStaffActionGate(createRequireRecentStaffAuth({ isRecent })));
  attachAdminCollectionStorageRoutes(
    admin as never,
    {
      admin: { collectionStorage: {}, collectionStorageFollowUp },
    } as never,
  );
  const app = new Hono<{ Variables: Vars }>();
  app.use("*", async (c, next) => {
    c.set("userId", "staff-1");
    c.set("userRole", "staff");
    c.set("userStaffRoles", staffRoles);
    c.set("identitySessionId", "sid-1");
    await next();
  });
  app.route("/admin", admin);
  return { app, storage, isRecent };
}

const send = (method: string, body?: unknown) => ({
  method,
  ...(body !== undefined
    ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : {}),
});

const base = `http://test/admin/collections/${VENUE}/storage`;
const overdue = `${base}/overdue`;
const extension = `${base}/lots/${LOT}/extension`;
const waiver = `${base}/lots/${LOT}/waiver`;

describe("Not collected access by role", () => {
  it.each(userStaffRoles)(
    "%s: everyone on the tab reads, Fulfilment extends, Finance waives",
    async (role) => {
      const admin = role === "administrator";
      const canRead = admin || ["fulfilment", "read_only", "finance"].includes(role);
      const canExtend = admin || role === "fulfilment";
      const canWaive = admin || role === "finance";

      const read = await createApp([role]).app.request(overdue);
      expect(read.status === 403, `${role} reads`).toBe(!canRead);

      const extending = createApp([role]);
      const extended = await extending.app.request(
        extension,
        send("POST", { days: 5, reason: "Buyer abroad" }),
      );
      expect(extended.status === 403, `${role} extends`).toBe(!canExtend);
      if (!canExtend) expect(extending.storage.audit).toEqual([]);

      const waiving = createApp([role]);
      const waived = await waiving.app.request(waiver, send("POST", { reason: "Goodwill" }));
      expect(waived.status === 403, `${role} waives`).toBe(!canWaive);
      if (!canWaive) expect(waiving.storage.audit).toEqual([]);
    },
  );

  it("refuses someone who is not staff", async () => {
    expect((await createApp(undefined).app.request(overdue)).status).toBe(403);
  });
});

describe("Not collected routes", () => {
  it("lists the lots over their day without caching", async () => {
    const res = await createApp(["read_only"]).app.request(overdue);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = (await res.json()) as { data: { lots: { lotId: string; daysOver: number }[] } };
    expect(body.data.lots).toEqual([expect.objectContaining({ lotId: LOT, daysOver: 32 })]);
  });

  it("waiving needs a recent sign-in; extending does not", async () => {
    const { app, storage, isRecent } = createApp(["administrator"], { recentSignIn: false });
    const waived = await app.request(waiver, send("POST", { reason: "Goodwill" }));
    expect(waived.status).toBe(403);
    expect(((await waived.json()) as { code: string }).code).toBe("step_up_required");
    expect(storage.audit).toEqual([]);
    isRecent.mockClear();
    const extended = await app.request(extension, send("POST", { days: 2, reason: "Travel" }));
    expect(extended.status).toBe(200);
    expect(isRecent).not.toHaveBeenCalled();
  });

  it.each([
    ["no days", { reason: "x" }],
    ["0 days", { days: 0, reason: "x" }],
    ["31 days", { days: 31, reason: "x" }],
    ["part of a day", { days: 1.5, reason: "x" }],
    ["no reason", { days: 3, reason: "  " }],
    ["an unknown field", { days: 3, reason: "x", waive: true }],
  ])("refuses an extension with %s and records nothing", async (_label, body) => {
    const { app, storage } = createApp(["fulfilment"]);
    expect((await app.request(extension, send("POST", body))).status).toBe(400);
    expect(storage.audit).toEqual([]);
  });

  it("refuses a waiver with no reason", async () => {
    const { app, storage } = createApp(["finance"]);
    expect((await app.request(waiver, send("POST", { reason: "" }))).status).toBe(400);
    expect(storage.audit).toEqual([]);
  });

  it("names the field when the cap is reached", async () => {
    const { app } = createApp(["fulfilment"]);
    await app.request(extension, send("POST", { days: 28, reason: "Long trip" }));
    const res = await app.request(extension, send("POST", { days: 3, reason: "More" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "extension_cap_reached",
      message: "This lot can have up to 2 more days.",
      issues: [{ field: "days", message: "This lot can have up to 2 more days." }],
    });
  });

  it("answers 404 for a lot not waiting at the place", async () => {
    const { app } = createApp(["finance"]);
    const res = await app.request(
      `${base}/lots/e0000000-0000-4000-8000-0000000000ff/waiver`,
      send("POST", { reason: "Goodwill" }),
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe("lot_not_found");
  });
});
