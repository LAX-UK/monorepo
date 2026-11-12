import { normalizeStaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../../container.js";
import type { IAuthenticator } from "../../services/interfaces/authenticator.js";
import { ReofferError } from "../../services/reoffer/reoffer-errors.js";
import { createAdminRoutes } from "../admin.js";

const LOT = "11111111-1111-4111-8111-111111111111";
const OFFER = "22222222-2222-4222-8222-222222222222";
const DEFAULT = "33333333-3333-4333-8333-333333333333";

function build(who: { role: string; staffRoles: string[]; recent?: boolean } | null) {
  const reoffer = {
    start: { start: vi.fn().mockResolvedValue({ reofferId: OFFER }) },
    consent: { recordForSeller: vi.fn().mockResolvedValue({ reofferId: OFFER }) },
    offer: {
      send: vi.fn().mockResolvedValue({ reofferId: OFFER }),
      withdraw: vi.fn().mockResolvedValue({ reofferId: OFFER }),
    },
    reads: { listForLot: vi.fn().mockResolvedValue([]) },
  };
  const container = {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    reoffer,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      stepUp: { isRecent: vi.fn().mockResolvedValue(who?.recent ?? true) },
    },
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue(
      who && {
        id: "usr_1",
        identitySessionId: "session-1",
        role: who.role,
        staffRoles: normalizeStaffRoles(who.staffRoles),
        scopes: ["bid.read", "bid.write"],
      },
    ),
  };
  const app = new Hono();
  app.route("/admin", createAdminRoutes(container, authenticator));
  return { app, reoffer };
}

const post = (app: Hono, path: string, body: unknown) =>
  app.request(`http://test/admin${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const ROUTES = {
  start: { path: `/lots/${LOT}/reoffers`, body: {} },
  answer: {
    path: `/reoffers/${OFFER}/seller-answer`,
    body: { answer: "given", note: "Phoned the seller" },
  },
  send: { path: `/reoffers/${OFFER}/send`, body: {} },
  withdraw: { path: `/reoffers/${OFFER}/withdraw`, body: { note: "Seller away" } },
} as const;

/** What each staff role gets: buyer default is sales and finance; the seller's answer is auction.manage. */
const MATRIX: Record<string, Record<keyof typeof ROUTES, number>> = {
  administrator: { start: 200, answer: 200, send: 200, withdraw: 200 },
  sales_manager: { start: 200, answer: 200, send: 200, withdraw: 200 },
  // Finance holds the buyer-default permission but is outside the platform shell, as everywhere under /admin.
  finance: { start: 403, answer: 403, send: 403, withdraw: 403 },
  saleroom_clerk: { start: 403, answer: 403, send: 403, withdraw: 403 },
  cataloguer: { start: 403, answer: 403, send: 403, withdraw: 403 },
  specialist: { start: 403, answer: 403, send: 403, withdraw: 403 },
  client_services: { start: 403, answer: 403, send: 403, withdraw: 403 },
  fulfilment: { start: 403, answer: 403, send: 403, withdraw: 403 },
  compliance: { start: 403, answer: 403, send: 403, withdraw: 403 },
  read_only: { start: 403, answer: 403, send: 403, withdraw: 403 },
};

describe("admin re-offer routes", () => {
  describe("permissions", () => {
    for (const [staffRole, expected] of Object.entries(MATRIX)) {
      for (const [name, route] of Object.entries(ROUTES)) {
        const want = expected[name as keyof typeof ROUTES];
        it(`${staffRole} ${want === 200 ? "may" : "may not"} ${name}`, async () => {
          const { app, reoffer } = build({ role: "staff", staffRoles: [staffRole] });
          const res = await post(app, route.path, route.body);
          expect(res.status).toBe(want);
          if (want === 403) {
            for (const service of [
              reoffer.start.start,
              reoffer.consent.recordForSeller,
              reoffer.offer.send,
              reoffer.offer.withdraw,
            ]) {
              expect(service).not.toHaveBeenCalled();
            }
          }
        });
      }
    }

    it("turns away a client account and an anonymous caller", async () => {
      for (const route of Object.values(ROUTES)) {
        const client = build({ role: "client", staffRoles: [] });
        expect((await post(client.app, route.path, route.body)).status).toBe(403);
        const anonymous = build(null);
        expect((await post(anonymous.app, route.path, route.body)).status).toBe(401);
      }
    });

    it("asks for a recent sign-in on every step, and does nothing without one", async () => {
      for (const route of Object.values(ROUTES)) {
        const { app, reoffer } = build({
          role: "staff",
          staffRoles: ["administrator"],
          recent: false,
        });
        const res = await post(app, route.path, route.body);
        expect(res.status).toBe(403);
        expect(((await res.json()) as { code?: string }).code).toBe("step_up_required");
        expect(reoffer.start.start).not.toHaveBeenCalled();
        expect(reoffer.consent.recordForSeller).not.toHaveBeenCalled();
        expect(reoffer.offer.send).not.toHaveBeenCalled();
        expect(reoffer.offer.withdraw).not.toHaveBeenCalled();
      }
    });

    it("lets read-only staff read the offers of a lot but not change them", async () => {
      const { app, reoffer } = build({ role: "staff", staffRoles: ["read_only"] });
      const res = await app.request(`http://test/admin/lots/${LOT}/reoffers`);
      expect(res.status).toBe(200);
      expect(reoffer.reads.listForLot).toHaveBeenCalledWith(LOT);
      const clerk = build({ role: "staff", staffRoles: ["saleroom_clerk"] });
      expect((await clerk.app.request(`http://test/admin/lots/${LOT}/reoffers`)).status).toBe(403);
    });
  });

  describe("validation", () => {
    const admin = { role: "staff", staffRoles: ["administrator"] };

    it.each([
      ["a non-uuid lot", "/lots/not-a-uuid/reoffers", {}],
      ["a non-uuid default", `/lots/${LOT}/reoffers`, { buyerDefaultId: "nope" }],
      ["an unknown field on start", `/lots/${LOT}/reoffers`, { price: 1 }],
      ["an answer without a note (RA3)", `/reoffers/${OFFER}/seller-answer`, { answer: "given" }],
      ["a blank note", `/reoffers/${OFFER}/seller-answer`, { answer: "given", note: "   " }],
      [
        "an answer that is not yes or no",
        `/reoffers/${OFFER}/seller-answer`,
        { answer: "maybe", note: "x" },
      ],
      [
        "a preference on a yes",
        `/reoffers/${OFFER}/seller-answer`,
        { answer: "given", note: "x", declinePreference: "later_sale" },
      ],
      ["a window of 0 days", `/reoffers/${OFFER}/send`, { offerDays: 0 }],
      ["a window of 8 days", `/reoffers/${OFFER}/send`, { offerDays: 8 }],
      ["a window in fractions", `/reoffers/${OFFER}/send`, { offerDays: 1.5 }],
      ["a price on send", `/reoffers/${OFFER}/send`, { priceMinor: 10 }],
      ["a withdrawal without a note", `/reoffers/${OFFER}/withdraw`, {}],
    ])("refuses %s", async (_label, path, body) => {
      const { app, reoffer } = build(admin);
      const res = await post(app, path, body);
      expect([400, 422]).toContain(res.status);
      expect(reoffer.start.start).not.toHaveBeenCalled();
      expect(reoffer.consent.recordForSeller).not.toHaveBeenCalled();
      expect(reoffer.offer.send).not.toHaveBeenCalled();
      expect(reoffer.offer.withdraw).not.toHaveBeenCalled();
    });
  });

  describe("what the routes hand to the services", () => {
    const admin = { role: "staff", staffRoles: ["administrator"] };

    it("starts from the lot and the default on the page", async () => {
      const { app, reoffer } = build(admin);
      await post(app, `/lots/${LOT}/reoffers`, { buyerDefaultId: DEFAULT });
      expect(reoffer.start.start).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "usr_1", role: "staff" }),
        LOT,
        { buyerDefaultId: DEFAULT },
      );
    });

    it("passes the seller's answer, note and preference", async () => {
      const { app, reoffer } = build(admin);
      await post(app, `/reoffers/${OFFER}/seller-answer`, {
        answer: "refused",
        note: "Said no by phone",
        declinePreference: "return_to_me",
      });
      expect(reoffer.consent.recordForSeller).toHaveBeenCalledWith(expect.anything(), OFFER, {
        answer: "refused",
        note: "Said no by phone",
        preferredNext: "return_to_me",
      });
    });

    it("sends with the default window left to the service, or the days staff chose", async () => {
      const { app, reoffer } = build(admin);
      await post(app, `/reoffers/${OFFER}/send`, {});
      await post(app, `/reoffers/${OFFER}/send`, { offerDays: 5 });
      expect(reoffer.offer.send).toHaveBeenNthCalledWith(1, expect.anything(), OFFER, { days: 3 });
      expect(reoffer.offer.send).toHaveBeenNthCalledWith(2, expect.anything(), OFFER, { days: 5 });
    });

    it("withdraws with the note as the reason", async () => {
      const { app, reoffer } = build(admin);
      await post(app, `/reoffers/${OFFER}/withdraw`, { note: "Seller away" });
      expect(reoffer.offer.withdraw).toHaveBeenCalledWith(expect.anything(), OFFER, {
        reason: "Seller away",
      });
    });
  });

  describe("errors", () => {
    it("answers a refusal with its status, code and words", async () => {
      const { app, reoffer } = build({ role: "staff", staffRoles: ["administrator"] });
      reoffer.offer.send.mockRejectedValueOnce(
        new ReofferError("artwork_offered_elsewhere", "This artwork is in a private sale."),
      );
      const res = await post(app, `/reoffers/${OFFER}/send`, {});
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({
        error: "This artwork is in a private sale.",
        code: "artwork_offered_elsewhere",
      });
      reoffer.start.start.mockRejectedValueOnce(new ReofferError("money_paused", "Paused."));
      expect((await post(app, `/lots/${LOT}/reoffers`, {})).status).toBe(423);
      reoffer.start.start.mockRejectedValueOnce(
        new ReofferError("lot_not_found", "Lot not found."),
      );
      expect((await post(app, `/lots/${LOT}/reoffers`, {})).status).toBe(404);
    });
  });
});
