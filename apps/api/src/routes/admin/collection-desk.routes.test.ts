import type { StaffRoles } from "@auction/types";
import { userStaffRoles } from "@auction/types";
import { Hono } from "hono";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { DANGEROUS_STAFF_ACTIONS } from "../../middleware/dangerous-staff-actions.js";
import { deskError } from "../../services/collection-desk/collection-desk.errors.js";
import { attachAdminCollectionDeskRoutes } from "./collection-desk.routes.js";

const VENUE = "d0000000-0000-4000-8000-0000000000aa";
const BOOKING = "d0000000-0000-4000-8000-0000000000b1";
const LOT = "d0000000-0000-4000-8000-0000000000c1";
const ACCOUNT = "d0000000-0000-4000-8000-0000000000d1";

function createApp(staffRoles: StaffRoles | undefined) {
  const view = { id: BOOKING };
  const collectionDesk = {
    day: vi.fn().mockResolvedValue(ok({ date: "2026-11-10" })),
    list: vi.fn().mockResolvedValue(ok({ items: [] })),
    handOver: vi.fn().mockResolvedValue(ok(view)),
    undoHandOver: vi.fn().mockResolvedValue(ok(view)),
    markNotCollected: vi.fn().mockResolvedValue(ok(view)),
    rebook: vi.fn().mockResolvedValue(ok(view)),
    bookForClient: vi.fn().mockResolvedValue(ok({ booking: view, replayed: false })),
  };
  const idempotentScopes: string[] = [];
  const guards = {
    requireStepUp: (async (_c: unknown, next: () => Promise<void>) => next()) as never,
    idempotent: (scope: string) => async (_c: unknown, next: () => Promise<void>) => {
      idempotentScopes.push(scope);
      await next();
    },
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
  attachAdminCollectionDeskRoutes(
    app as never,
    { admin: { collectionDesk } } as never,
    guards as never,
  );
  return { app, collectionDesk, idempotentScopes };
}

const post = (body: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const HAND_OVER = { lotIds: [LOT], idCheck: { confirmed: true, type: "passport" } };
const REBOOK = { version: 0, slotStart: "2026-11-11T10:00:00.000Z" };
const BOOK = {
  legalEntityId: ACCOUNT,
  lotIds: [LOT],
  slotStart: "2026-11-11T10:00:00.000Z",
  collector: { kind: "self", name: "Charlotte Hayes" },
  idempotencyKey: "desk-key-12345",
};

const reads: string[] = [
  `/collection-desk/${VENUE}/day?date=2026-11-10`,
  `/collection-desk/${VENUE}/bookings?status=upcoming`,
];
const writes: [string, unknown][] = [
  [`/collection-desk/bookings/${BOOKING}/hand-over`, HAND_OVER],
  [`/collection-desk/bookings/${BOOKING}/undo-hand-over`, {}],
  [`/collection-desk/bookings/${BOOKING}/not-collected`, {}],
  [`/collection-desk/bookings/${BOOKING}/rebook`, REBOOK],
  ["/collection-desk/bookings", BOOK],
];

describe("collection desk access", () => {
  it.each(userStaffRoles)(
    "%s: reads and changes follow the Collections permission",
    async (role) => {
      const canChange = role === "administrator" || role === "fulfilment";
      const canRead = canChange || role === "read_only";
      for (const path of reads) {
        const { app } = createApp([role]);
        const res = await app.request(`http://test${path}`);
        expect(res.status === 403, `${role} GET ${path}`).toBe(!canRead);
      }
      for (const [path, body] of writes) {
        const { app, collectionDesk } = createApp([role]);
        const res = await app.request(`http://test${path}`, post(body));
        expect(res.status === 403, `${role} POST ${path}`).toBe(!canChange);
        if (!canChange) {
          expect(collectionDesk.handOver).not.toHaveBeenCalled();
          expect(collectionDesk.bookForClient).not.toHaveBeenCalled();
        }
      }
    },
  );
});

describe("collection desk routes", () => {
  it("reads a day without caching it", async () => {
    const { app, collectionDesk } = createApp(["fulfilment"]);
    const res = await app.request(`http://test${reads[0]}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(collectionDesk.day).toHaveBeenCalledWith(VENUE, "2026-11-10");
  });

  it("passes the acting staff member, the booking and the ID check to a hand-over", async () => {
    const { app, collectionDesk } = createApp(["fulfilment"]);
    const res = await app.request(
      `http://test/collection-desk/bookings/${BOOKING}/hand-over`,
      post(HAND_OVER),
    );
    expect(res.status).toBe(200);
    expect(collectionDesk.handOver).toHaveBeenCalledWith({ userId: "staff-1" }, BOOKING, HAND_OVER);
  });

  it("will not take an ID number or a copy: the body holds the type only", async () => {
    const { app, collectionDesk } = createApp(["fulfilment"]);
    const withNumber = {
      lotIds: [LOT],
      idCheck: { confirmed: true, type: "passport", number: "123456789" },
    };
    const res = await app.request(
      `http://test/collection-desk/bookings/${BOOKING}/hand-over`,
      post(withNumber),
    );
    expect(res.status).toBe(400);
    expect(collectionDesk.handOver).not.toHaveBeenCalled();
  });

  it("needs the ID check to be confirmed", async () => {
    const { app, collectionDesk } = createApp(["fulfilment"]);
    const res = await app.request(
      `http://test/collection-desk/bookings/${BOOKING}/hand-over`,
      post({ lotIds: [LOT], idCheck: { confirmed: false, type: "passport" } }),
    );
    expect(res.status).toBe(400);
    expect(collectionDesk.handOver).not.toHaveBeenCalled();
  });

  it("asks for an idempotency key on hand-over, undo and not collected, and for nothing else", async () => {
    const { app, idempotentScopes } = createApp(["fulfilment"]);
    await app.request(`http://test/collection-desk/bookings/${BOOKING}/hand-over`, post(HAND_OVER));
    await app.request(`http://test/collection-desk/bookings/${BOOKING}/undo-hand-over`, post({}));
    await app.request(`http://test/collection-desk/bookings/${BOOKING}/not-collected`, post({}));
    expect(idempotentScopes).toEqual([
      "collection.hand-over",
      "collection.hand-over-undo",
      "collection.not-collected",
    ]);
  });

  it("lists hand-over, its undo and not collected as step-up actions", () => {
    const paths = DANGEROUS_STAFF_ACTIONS.filter((a) => a.category === "collection_handover").map(
      (a) => `${a.method} ${a.path}`,
    );
    expect(paths.sort()).toEqual(
      [
        "POST /admin/collection-desk/bookings/:bookingId/hand-over",
        "POST /admin/collection-desk/bookings/:bookingId/not-collected",
        "POST /admin/collection-desk/bookings/:bookingId/undo-hand-over",
      ].sort(),
    );
  });

  it("keeps a refusal's status, code and the lots at fault", async () => {
    const { app, collectionDesk } = createApp(["fulfilment"]);
    collectionDesk.handOver.mockResolvedValue(err(deskError("not_released", { lotIds: [LOT] })));
    const res = await app.request(
      `http://test/collection-desk/bookings/${BOOKING}/hand-over`,
      post(HAND_OVER),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "not_released", lotIds: [LOT] });
  });

  it("books for a client with 201, and 200 for a repeat", async () => {
    const { app, collectionDesk } = createApp(["fulfilment"]);
    const first = await app.request("http://test/collection-desk/bookings", post(BOOK));
    expect(first.status).toBe(201);
    collectionDesk.bookForClient.mockResolvedValue(
      ok({ booking: { id: BOOKING }, replayed: true }),
    );
    const again = await app.request("http://test/collection-desk/bookings", post(BOOK));
    expect(again.status).toBe(200);
    expect(again.headers.get("Idempotent-Replayed")).toBe("true");
  });

  it("passes a rebook with its version and an override reason", async () => {
    const { app, collectionDesk } = createApp(["fulfilment"]);
    const body = { ...REBOOK, override: { reason: "Client phoned" } };
    await app.request(`http://test/collection-desk/bookings/${BOOKING}/rebook`, post(body));
    expect(collectionDesk.rebook).toHaveBeenCalledWith({ userId: "staff-1" }, BOOKING, body);
  });

  it("rejects an override without a reason", async () => {
    const { app, collectionDesk } = createApp(["fulfilment"]);
    const res = await app.request(
      `http://test/collection-desk/bookings/${BOOKING}/rebook`,
      post({ ...REBOOK, override: { reason: "" } }),
    );
    expect(res.status).toBe(400);
    expect(collectionDesk.rebook).not.toHaveBeenCalled();
  });
});
