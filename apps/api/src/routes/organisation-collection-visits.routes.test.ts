import type { LegalEntityMemberRole } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerOrganisationBuyingRoutesSlice } from "../container.js";
import { createRequireAccountOnboarding } from "../middleware/require-account-onboarding.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import { CollectionLotGuard } from "../services/collection-visits/collection-lot-guard.js";
import { CollectionVisitService } from "../services/collection-visits/collection-visit.service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import {
  COLLECTION_ACCOUNT,
  COLLECTION_LOTS,
  COLLECTION_NOW,
  InMemoryCollectionBookings,
  InMemoryCollectionLotFacts,
  InMemoryCollectionPlaces,
  RecordingEvents,
} from "../testing/in-memory-collection-visits.js";
import { createOrganisationCollectionVisitRoutes } from "./organisation-collection-visits.js";

type Options = {
  onboarded?: boolean;
  platformRole?: string;
  suspended?: boolean;
  signedOut?: boolean;
  impersonating?: boolean;
  /** How many writes the counter allows before refusing; unlimited by default. */
  writesAllowed?: number;
  counterDown?: boolean;
};

function mount(
  role: LegalEntityMemberRole,
  opts: Options = {},
  bookings?: InMemoryCollectionBookings,
) {
  const facts = new InMemoryCollectionLotFacts();
  const store = bookings ?? new InMemoryCollectionBookings();
  const events = new RecordingEvents();
  const context: LegalEntityContext = {
    legalEntityId: COLLECTION_ACCOUNT,
    userId: `${role}-1`,
    role,
    isPrimaryAdmin: role === "owner",
    ...(opts.impersonating ? { isImpersonation: true } : {}),
  };
  let counted = 0;
  const container = {
    rateLimitStore: {
      increment: async () => {
        if (opts.counterDown) throw new Error("redis down");
        counted += 1;
        return {
          allowed: counted <= (opts.writesAllowed ?? 1_000),
          remaining: 0,
          retryAfterSec: 900,
        };
      },
    },
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(opts.suspended ?? false) },
    requireLegalEntityContext: async (
      c: { set: (key: string, value: LegalEntityContext) => void },
      next: () => Promise<void>,
    ) => {
      c.set("legalEntityContext", context);
      await next();
    },
    organisationBuying: {
      collectionVisits: new CollectionVisitService({
        lots: new CollectionLotGuard(facts),
        facts,
        places: new InMemoryCollectionPlaces(),
        bookings: store,
        events,
        now: () => COLLECTION_NOW,
      }),
    },
  } as unknown as ContainerOrganisationBuyingRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue(
      opts.signedOut
        ? null
        : {
            id: context.userId,
            role: opts.platformRole ?? "client",
            scopes: ["bid.read", "bid.write"],
          },
    ),
  };
  const app = new Hono();
  const onboarding = createRequireAccountOnboarding({
    isComplete: async () => opts.onboarded ?? true,
  });
  app.route(
    "/legal-entities",
    createOrganisationCollectionVisitRoutes(container, authenticator, onboarding),
  );
  return { app, store, events };
}

const send = (app: Hono, method: string, path: string, json?: unknown) =>
  app.request(`/legal-entities${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(json === undefined ? {} : { body: JSON.stringify(json) }),
  });

let counter = 0;
const bookingBody = (over: Record<string, unknown> = {}) => {
  counter += 1;
  return {
    lotIds: [COLLECTION_LOTS.one],
    slotStart: "2026-11-10T10:00:00Z",
    collector: { kind: "self", name: "Maya Okafor" },
    idempotencyKey: `route-key-${String(counter).padStart(6, "0")}`,
    ...over,
  };
};

type Json = Record<string, unknown> & {
  data: Record<string, unknown> & {
    id: string;
    version: number;
    reference: string;
    days: unknown[];
    lots: unknown[];
  };
};
const json = async (response: Response) => (await response.json()) as never as Json;

describe("the gates", () => {
  it.each([
    ["GET", `/collection/availability?lots=${COLLECTION_LOTS.one}`],
    ["GET", "/collection/bookings"],
    ["POST", "/collection/bookings"],
    ["PATCH", "/collection/bookings/c0000000-0000-4000-8000-0000000000e1"],
    ["POST", "/collection/bookings/c0000000-0000-4000-8000-0000000000e1/cancel"],
    ["GET", "/collection/bookings/c0000000-0000-4000-8000-0000000000e1/calendar.ics"],
  ])("%s %s needs a signed-in person", async (method, path) => {
    const { app } = mount("owner", { signedOut: true });
    const response = await send(app, method, path, method === "GET" ? undefined : {});
    expect(response.status).toBe(401);
  });

  it("is for buyer accounts: staff do not book through it", async () => {
    const { app } = mount("owner", { platformRole: "admin" });
    expect((await send(app, "GET", "/collection/bookings")).status).toBe(403);
    expect((await send(app, "POST", "/collection/bookings", bookingBody())).status).toBe(403);
  });

  it("is closed to a suspended account", async () => {
    const { app } = mount("owner", { suspended: true });
    expect((await send(app, "GET", "/collection/bookings")).status).toBeGreaterThanOrEqual(401);
    expect((await send(app, "GET", "/collection/bookings")).status).not.toBe(200);
  });

  it("holds the writes for accounts that have finished onboarding, and lets the reads through", async () => {
    const { app, store } = mount("owner", { onboarded: false });
    expect((await send(app, "GET", "/collection/bookings")).status).toBe(200);
    expect((await send(app, "POST", "/collection/bookings", bookingBody())).status).toBe(403);
    expect(store.bookings).toHaveLength(0);
  });

  it("never caches an answer", async () => {
    const { app } = mount("owner");
    const response = await send(app, "GET", `/collection/availability?lots=${COLLECTION_LOTS.one}`);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const booked = await send(app, "POST", "/collection/bookings", bookingBody());
    expect(booked.headers.get("cache-control")).toBe("no-store");
  });
});

describe("what each role may do", () => {
  const MATRIX: Record<LegalEntityMemberRole, { list: number; book: number }> = {
    owner: { list: 200, book: 201 },
    admin: { list: 200, book: 201 },
    finance: { list: 200, book: 201 },
    // A buyer agent follows and books only what they won; this lot was won by the owner.
    buyer_agent: { list: 200, book: 403 },
    consignor: { list: 403, book: 403 },
    viewer: { list: 403, book: 403 },
  };
  it.each(Object.entries(MATRIX))("%s", async (role, expected) => {
    const { app } = mount(role as LegalEntityMemberRole);
    expect((await send(app, "GET", "/collection/bookings")).status).toBe(expected.list);
    expect((await send(app, "POST", "/collection/bookings", bookingBody())).status).toBe(
      expected.book,
    );
  });
});

describe("availability", () => {
  it("answers with days, times and the lots", async () => {
    const { app } = mount("owner");
    const response = await send(app, "GET", `/collection/availability?lots=${COLLECTION_LOTS.one}`);
    expect(response.status).toBe(200);
    const { data } = await json(response);
    expect(data.days).toHaveLength(28);
    expect(data.earliest).toBe("2026-11-10T10:00:00.000Z");
    expect(data.lots[0]).toMatchObject({ lotId: COLLECTION_LOTS.one, collectable: true });
  });

  it("refuses a malformed list of lots, and no lots", async () => {
    const { app } = mount("owner");
    expect((await send(app, "GET", "/collection/availability?lots=nope")).status).toBe(400);
    const none = await send(app, "GET", "/collection/availability");
    expect(none.status).toBe(400);
    expect((await json(none)).error).toBe("no_lots");
  });

  it("says not found for another account's lot", async () => {
    const { app } = mount("owner");
    const response = await send(
      app,
      "GET",
      `/collection/availability?lots=${COLLECTION_LOTS.otherAccount}`,
    );
    expect(response.status).toBe(404);
    expect((await json(response)).error).toBe("lot_not_found");
  });

  it("can be read while viewing as the account", async () => {
    const { app } = mount("owner", { impersonating: true });
    expect(
      (await send(app, "GET", `/collection/availability?lots=${COLLECTION_LOTS.one}`)).status,
    ).toBe(200);
  });
});

describe("booking", () => {
  it("answers 201 with the visit", async () => {
    const { app, events } = mount("owner");
    const response = await send(app, "POST", "/collection/bookings", bookingBody());
    expect(response.status).toBe(201);
    const { data } = await json(response);
    expect(data).toMatchObject({ status: "booked", reference: expect.stringMatching(/^COL-/) });
    expect(events.events.map((e) => e.eventType)).toEqual(["collection.booking.created"]);
  });

  it("answers a repeat of the same attempt with the same booking, marked as a replay", async () => {
    const { app, store } = mount("owner");
    const request = bookingBody();
    const first = await send(app, "POST", "/collection/bookings", request);
    const again = await send(app, "POST", "/collection/bookings", request);
    expect(again.status).toBe(200);
    expect(again.headers.get("Idempotent-Replayed")).toBe("true");
    expect((await json(again)).data.id).toBe((await json(first)).data.id);
    expect(store.bookings).toHaveLength(1);
  });

  it("answers the same key with a different request with 409 idempotency_key_reused", async () => {
    const { app, store } = mount("owner");
    const request = bookingBody();
    await send(app, "POST", "/collection/bookings", request);
    const response = await send(app, "POST", "/collection/bookings", {
      ...request,
      slotStart: "2026-11-11T10:00:00Z",
    });
    expect(response.status).toBe(409);
    expect((await json(response)).error).toBe("idempotency_key_reused");
    expect(store.bookings).toHaveLength(1);
  });

  it("answers a full time with 409 slot_full", async () => {
    const { app } = mount("owner");
    await send(app, "POST", "/collection/bookings", bookingBody({ lotIds: [COLLECTION_LOTS.one] }));
    await send(app, "POST", "/collection/bookings", bookingBody({ lotIds: [COLLECTION_LOTS.two] }));
    const response = await send(
      app,
      "POST",
      "/collection/bookings",
      bookingBody({ lotIds: [COLLECTION_LOTS.three] }),
    );
    expect(response.status).toBe(409);
    expect((await json(response)).error).toBe("slot_full");
  });

  it("names the lot that cannot be collected, and why, with 422", async () => {
    const { app } = mount("owner");
    const response = await send(
      app,
      "POST",
      "/collection/bookings",
      bookingBody({ lotIds: [COLLECTION_LOTS.unpaid] }),
    );
    expect(response.status).toBe(422);
    expect(await json(response)).toMatchObject({
      error: "lot_not_collectable",
      lotId: COLLECTION_LOTS.unpaid,
      reason: "payment_not_cleared",
    });
  });

  it("names the problem with who collects", async () => {
    const { app } = mount("owner");
    const response = await send(
      app,
      "POST",
      "/collection/bookings",
      bookingBody({ collector: { kind: "third_party", name: "Sam Okoro" } }),
    );
    expect(response.status).toBe(422);
    expect(await json(response)).toMatchObject({
      error: "collector_invalid",
      issues: [{ field: "authorisation", code: "authorisation_required" }],
    });
  });

  it("refuses a body with anything it does not know, or the wrong shape", async () => {
    const { app, store } = mount("owner");
    for (const bad of [
      bookingBody({ bookedVia: "staff" }),
      bookingBody({ lotIds: [] }),
      bookingBody({ slotStart: "tomorrow" }),
      bookingBody({ idempotencyKey: "short" }),
      {},
    ]) {
      expect((await send(app, "POST", "/collection/bookings", bad)).status).toBe(400);
    }
    expect(store.bookings).toHaveLength(0);
  });

  it("is refused while viewing as the account, and stores nothing", async () => {
    const { app, store, events } = mount("owner", { impersonating: true });
    const response = await send(app, "POST", "/collection/bookings", bookingBody());
    expect(response.status).toBe(403);
    expect((await json(response)).error).toBe("read_only");
    expect(store.bookings).toHaveLength(0);
    expect(events.events).toHaveLength(0);
  });
});

describe("changing and cancelling", () => {
  async function visit(app: Hono) {
    const response = await send(app, "POST", "/collection/bookings", bookingBody());
    return (await json(response)).data as { id: string; version: number };
  }
  const changeBody = (version: number, over: Record<string, unknown> = {}) => ({
    version,
    lotIds: [COLLECTION_LOTS.one],
    slotStart: "2026-11-11T10:00:00Z",
    collector: { kind: "self", name: "Maya Okafor" },
    ...over,
  });

  it("moves a visit", async () => {
    const { app } = mount("owner");
    const created = await visit(app);
    const response = await send(
      app,
      "PATCH",
      `/collection/bookings/${created.id}`,
      changeBody(created.version),
    );
    expect(response.status).toBe(200);
    expect((await json(response)).data).toMatchObject({
      start: "2026-11-11T10:00:00.000Z",
      version: 1,
    });
  });

  it("answers a stale copy with 409 booking_changed", async () => {
    const { app } = mount("owner");
    const created = await visit(app);
    const response = await send(app, "PATCH", `/collection/bookings/${created.id}`, changeBody(7));
    expect(response.status).toBe(409);
    expect((await json(response)).error).toBe("booking_changed");
  });

  it("cancels a visit and cannot cancel it again", async () => {
    const { app } = mount("owner");
    const created = await visit(app);
    const path = `/collection/bookings/${created.id}/cancel`;
    const done = await send(app, "POST", path, { version: created.version });
    expect(done.status).toBe(200);
    expect((await json(done)).data.status).toBe("cancelled");
    const again = await send(app, "POST", path, { version: 1 });
    expect(again.status).toBe(409);
    expect((await json(again)).error).toBe("booking_closed");
  });

  it("answers an unknown or malformed booking id with 404 or 400", async () => {
    const { app } = mount("owner");
    const unknown = await send(
      app,
      "POST",
      "/collection/bookings/c0000000-0000-4000-8000-0000000000e1/cancel",
      { version: 0 },
    );
    expect(unknown.status).toBe(404);
    expect(
      (await send(app, "POST", "/collection/bookings/COL-1001/cancel", { version: 0 })).status,
    ).toBe(400);
  });

  it("is refused while viewing as the account", async () => {
    const { app: owner, store } = mount("owner");
    const created = await visit(owner);
    const { app } = mount("owner", { impersonating: true }, store);
    const cancel = await send(app, "POST", `/collection/bookings/${created.id}/cancel`, {
      version: 0,
    });
    expect(cancel.status).toBe(403);
    expect((await json(cancel)).error).toBe("read_only");
    expect((await store.findById(created.id))?.status).toBe("booked");
  });
});

describe("my visits and the calendar file", () => {
  it("lists the visits with what can still be done", async () => {
    const { app } = mount("owner");
    await send(app, "POST", "/collection/bookings", bookingBody());
    const response = await send(app, "GET", "/collection/bookings");
    const { data } = await json(response);
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ actions: ["change", "cancel"], bookedByYou: true });
  });

  it("serves the calendar file as a download that is not cached", async () => {
    const { app } = mount("owner");
    const created = (await json(await send(app, "POST", "/collection/bookings", bookingBody())))
      .data;
    const response = await send(app, "GET", `/collection/bookings/${created.id}/calendar.ics`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/calendar");
    expect(response.headers.get("content-disposition")).toContain(
      `collection-${created.reference}.ics`,
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toContain("BEGIN:VCALENDAR");
  });
});

describe("how often an account may change its collections", () => {
  it("refuses a booking, a change and a cancel once the hour's budget is used, with a retry time", async () => {
    const { app, store } = mount("owner", { writesAllowed: 1 });
    expect((await send(app, "POST", "/collection/bookings", bookingBody())).status).toBe(201);
    const stored = store.bookings.length;

    const book = await send(app, "POST", "/collection/bookings", bookingBody());
    expect(book.status).toBe(429);
    expect(book.headers.get("retry-after")).toBe("900");
    expect(await book.json()).toMatchObject({ error: "rate_limit_exceeded" });
    const id = store.bookings[0]?.id as string;
    expect((await send(app, "PATCH", `/collection/bookings/${id}`, {})).status).toBe(429);
    expect((await send(app, "POST", `/collection/bookings/${id}/cancel`, {})).status).toBe(429);
    expect(store.bookings).toHaveLength(stored);
  });

  it("never limits reading", async () => {
    const { app } = mount("owner", { writesAllowed: 0 });
    expect((await send(app, "GET", "/collection/bookings")).status).toBe(200);
  });

  it("lets a write through when the counter is unreachable", async () => {
    const { app } = mount("owner", { counterDown: true });
    expect((await send(app, "POST", "/collection/bookings", bookingBody())).status).toBe(201);
  });
});
