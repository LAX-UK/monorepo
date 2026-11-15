import type { StaffRoles } from "@auction/types";
import { userStaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createDangerousStaffActionGate } from "../../middleware/dangerous-staff-action-gate.js";
import { createRequireRecentStaffAuth } from "../../middleware/require-recent-staff-auth.js";
import { CollectionStorageAdminService } from "../../services/collection-storage/collection-storage.service.js";
import { InMemoryCollectionStorage } from "../../testing/in-memory-collection-storage.js";
import { attachAdminCollectionPlacesRoutes } from "./collection-settings.routes.js";
import { attachAdminCollectionStorageRoutes } from "./collection-storage.routes.js";

const VENUE = "d0000000-0000-4000-8000-0000000000aa";
const TERMS_ID = "d0000000-0000-4000-8000-0000000000c1";
const NOW = new Date("2026-11-15T12:00:00Z");

type Vars = {
  userId?: string;
  userRole?: string;
  userStaffRoles?: StaffRoles | undefined;
  identitySessionId?: string;
  staffStepUpVerified?: true;
};

/**
 * The storage routes as the API mounts them under /admin: behind the step-up gate, on the real
 * service with an in-memory store, so a test sees the status, the body and the audit row.
 */
function createApp(staffRoles: StaffRoles | undefined, opts: { recentSignIn?: boolean } = {}) {
  const storage = new InMemoryCollectionStorage();
  storage.names.set("staff-1", "Fran Finance");
  const venues = vi
    .fn()
    .mockResolvedValue([
      { venueId: VENUE, name: "Gallery", hasPlace: true, onlineBookingEnabled: true },
    ]);
  const collectionStorage = new CollectionStorageAdminService({
    storage,
    places: { venues },
    now: () => NOW,
  });
  const isRecent = vi.fn().mockResolvedValue(opts.recentSignIn ?? true);
  const admin = new Hono<{ Variables: Vars }>();
  admin.use("*", createDangerousStaffActionGate(createRequireRecentStaffAuth({ isRecent })));
  const container = { admin: { collectionStorage, collectionSettings: { venues } } } as never;
  attachAdminCollectionPlacesRoutes(admin as never, container);
  attachAdminCollectionStorageRoutes(admin as never, container);
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

const CHANGE = {
  effectiveFrom: "2026-12-01",
  reason: "New rates for December",
  freeDays: 14,
  countMode: "calendar",
  standardDailyPence: 350,
  largeDailyPence: 700,
  handlingFeePence: 0,
};

const base = `http://test/admin/collections/${VENUE}/storage`;
const reads: [string, string][] = [
  ["GET", "http://test/admin/collections"],
  ["GET", base],
];
const writes: [string, string, unknown][] = [
  ["POST", `${base}/terms`, CHANGE],
  ["PUT", `${base}/terms/${TERMS_ID}`, CHANGE],
  ["POST", `${base}/terms/${TERMS_ID}/cancel`, { reason: "Wrong date" }],
  ["PUT", `${base}/charging`, { raiseInvoices: true, reason: "VAT agreed" }],
];

describe("storage access by role", () => {
  it.each(userStaffRoles)("%s: Finance and Admin change; Fulfilment looks", async (role) => {
    const canChange = role === "administrator" || role === "finance";
    const canRead = canChange || role === "fulfilment" || role === "read_only";
    for (const [method, url] of reads) {
      const { app } = createApp([role]);
      const res = await app.request(url, send(method));
      expect(res.status === 403, `${role} ${method} ${url}`).toBe(!canRead);
    }
    for (const [method, url, body] of writes) {
      const { app, storage } = createApp([role]);
      const res = await app.request(url, send(method, body));
      expect(res.status === 403, `${role} ${method} ${url}`).toBe(!canChange);
      if (!canChange) expect(storage.audit).toEqual([]);
    }
  });

  it("refuses someone who is not staff", async () => {
    const { app } = createApp(undefined);
    expect((await app.request(base)).status).toBe(403);
  });
});

describe("step-up", () => {
  it.each(writes)("%s %s needs a recent sign-in", async (method, url, body) => {
    const { app, storage } = createApp(["finance"], { recentSignIn: false });
    const res = await app.request(url, send(method, body));
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code: string }).code).toBe("step_up_required");
    expect(storage.audit).toEqual([]);
    expect(storage.terms).toEqual([]);
  });

  it("does not ask for one to read the tab", async () => {
    const { app, isRecent } = createApp(["finance"], { recentSignIn: false });
    expect((await app.request(base)).status).toBe(200);
    expect(isRecent).not.toHaveBeenCalled();
  });
});

describe("validation at the edge", () => {
  it.each([
    ["negative pence", { standardDailyPence: -100 }],
    ["fractional pence", { largeDailyPence: 700.5 }],
    ["a rate over £500.00", { standardDailyPence: 50_001 }],
    ["a handling fee over £500.00", { handlingFeePence: 50_001 }],
    ["free days over 90", { freeDays: 91 }],
    ["negative free days", { freeDays: -1 }],
    ["a missing reason", { reason: "" }],
    ["a date that is not a date", { effectiveFrom: "2026-13-01" }],
  ])("refuses %s with 400 and stores nothing", async (_label, over) => {
    const { app, storage } = createApp(["finance"]);
    const res = await app.request(`${base}/terms`, send("POST", { ...CHANGE, ...over }));
    expect(res.status).toBe(400);
    expect(storage.terms).toEqual([]);
    expect(storage.audit).toEqual([]);
  });

  it("refuses a start before tomorrow with the field at fault", async () => {
    const { app } = createApp(["finance"]);
    const res = await app.request(
      `${base}/terms`,
      send("POST", { ...CHANGE, effectiveFrom: "2026-11-15" }),
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: "start_not_in_future",
      message: "Choose a date from tomorrow.",
      issues: [{ field: "effectiveFrom", message: "Choose a date from tomorrow." }],
    });
  });

  it("refuses a malformed place id", async () => {
    const { app } = createApp(["finance"]);
    expect((await app.request("http://test/admin/collections/not-a-uuid/storage")).status).toBe(
      400,
    );
  });
});

describe("storage routes", () => {
  it("answers a read without caching it", async () => {
    const { app } = createApp(["fulfilment"]);
    const res = await app.request(base);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(((await res.json()) as { data: { venueId: string } }).data.venueId).toBe(VENUE);
  });

  it("schedules a change, audits it with who and why, and answers with the tab", async () => {
    const { app, storage } = createApp(["finance"]);
    const res = await app.request(`${base}/terms`, send("POST", CHANGE));
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as {
      data: { scheduled: { effectiveFrom: string }; history: { who: string; reason: string }[] };
    };
    expect(data.scheduled.effectiveFrom).toBe("2026-12-01");
    expect(data.history[0]).toMatchObject({ who: "Fran Finance", reason: CHANGE.reason });
    expect(storage.audit).toEqual([
      expect.objectContaining({
        action: "terms_scheduled",
        actorUserId: "staff-1",
        createdAt: NOW,
        before: null,
        after: expect.objectContaining({ standardDailyPence: 350 }),
        reason: CHANGE.reason,
      }),
    ]);
  });

  it("edits and cancels the scheduled change, auditing each", async () => {
    const { app, storage } = createApp(["administrator"]);
    await app.request(`${base}/terms`, send("POST", CHANGE));
    // The store numbers its ids; the database's are uuids, as the route expects.
    const [first] = storage.terms;
    if (!first) throw new Error("The change was not scheduled");
    first.id = TERMS_ID;
    const edited = await app.request(
      `${base}/terms/${TERMS_ID}`,
      send("PUT", { ...CHANGE, standardDailyPence: 400, reason: "Round up" }),
    );
    expect(edited.status).toBe(200);
    const cancelled = await app.request(
      `${base}/terms/${TERMS_ID}/cancel`,
      send("POST", { reason: "Not this year" }),
    );
    expect(cancelled.status).toBe(200);
    expect(storage.audit.map((row) => [row.action, row.reason])).toEqual([
      ["terms_scheduled", CHANGE.reason],
      ["terms_edited", "Round up"],
      ["terms_cancelled", "Not this year"],
    ]);
    expect(storage.audit[1]).toMatchObject({
      before: expect.objectContaining({ standardDailyPence: 350 }),
      after: expect.objectContaining({ standardDailyPence: 400 }),
    });
  });

  it("keeps charging off without a VAT treatment, with the reason", async () => {
    const { app, storage } = createApp(["finance"]);
    const res = await app.request(
      `${base}/charging`,
      send("PUT", { raiseInvoices: true, reason: "Ready" }),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: "vat_treatment_required",
      message: "Storage invoices can be switched on once Finance chooses a VAT treatment for them.",
    });
    expect(storage.audit).toEqual([]);
  });
});
