import type { LegalEntityMemberRole } from "@auction/types";
import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContainerReofferRoutesSlice } from "../container/container-slices.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { ReofferConsentService } from "../services/reoffer/reoffer-consent.service.js";
import { ReofferReadsService } from "../services/reoffer/reoffer-reads.service.js";
import { ReofferResponseService } from "../services/reoffer/reoffer-response.service.js";
import { createOrganisationReofferRoutes } from "./organisation-reoffers.js";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const OFFER = "22222222-2222-4222-8222-222222222222";

const ROLES: LegalEntityMemberRole[] = [
  "owner",
  "admin",
  "finance",
  "consignor",
  "viewer",
  "buyer_agent",
];

/** A transaction runner that never runs: a request that reaches it was let through by the role check. */
const reachedTransaction = vi.fn(async () => {
  throw new Error("reached the transaction");
});

function mount(role: LegalEntityMemberRole, userRole = "client") {
  const context: LegalEntityContext = {
    legalEntityId: ACCOUNT,
    userId: `${role}-1`,
    role,
    isPrimaryAdmin: role === "owner",
  };
  const never = new Proxy({}, { get: () => () => Promise.reject(new Error("unexpected call")) });
  const reads = new ReofferReadsService({
    db: never as never,
    views: {
      listForLot: async () => [],
      listForBidderAccount: async () => [],
      findForBidderAccount: async () => null,
      listForSellerAccount: async () => [],
      findForSellerAccount: async () => null,
    },
    workflow: never as never,
    pricing: never as never,
  });
  const tx = { runInTransaction: reachedTransaction } as never;
  const response = new ReofferResponseService({
    transactionRunner: tx,
    workflow: never as never,
    offers: never as never,
    consents: never as never,
    reaward: never as never,
    recorder: never as never,
    atg: never as never,
    place: never as never,
    moneyPause: never as never,
    invoicing: never as never,
  });
  const consent = new ReofferConsentService({
    transactionRunner: tx,
    workflow: never as never,
    offers: never as never,
    consents: never as never,
    recorder: never as never,
  });
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    requireLegalEntityContext: async (
      c: { set: (key: string, value: LegalEntityContext) => void },
      next: () => Promise<void>,
    ) => {
      c.set("legalEntityContext", context);
      await next();
    },
    reoffer: { reads, response, consent },
  } as unknown as ContainerReofferRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: context.userId, role: userRole, scopes: ["bid.read", "bid.write"] }),
  };
  const app = new Hono();
  app.route("/legal-entities", createOrganisationReofferRoutes(container, authenticator));
  return app;
}

const send = (app: Hono, method: string, path: string, body?: unknown) =>
  app.request(`http://test/legal-entities${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

/** 200 for a read that finds nothing; "role" for a refusal by role; "gate" for a write that got past the role check. */
const MATRIX: Record<
  string,
  { call: (app: Hono) => Response | Promise<Response>; allowed: LegalEntityMemberRole[] }
> = {
  "GET /reoffers": {
    call: (app) => send(app, "GET", "/reoffers"),
    allowed: ROLES,
  },
  "POST /reoffers/:id/accept": {
    call: (app) => send(app, "POST", `/reoffers/${OFFER}/accept`, { termsAccepted: true }),
    allowed: ["owner", "admin", "buyer_agent"],
  },
  "POST /reoffers/:id/decline": {
    call: (app) => send(app, "POST", `/reoffers/${OFFER}/decline`, {}),
    allowed: ["owner", "admin", "buyer_agent"],
  },
  "GET /reoffer-requests": {
    call: (app) => send(app, "GET", "/reoffer-requests"),
    allowed: ["owner", "admin", "finance", "consignor", "viewer"],
  },
  "POST /reoffer-requests/:id/answer": {
    call: (app) => send(app, "POST", `/reoffer-requests/${OFFER}/answer`, { answer: "given" }),
    allowed: ["owner", "admin"],
  },
};

describe("workspace re-offer routes", () => {
  beforeEach(() => {
    reachedTransaction.mockClear();
  });

  describe("403 matrix by member role", () => {
    for (const [name, { call, allowed }] of Object.entries(MATRIX)) {
      for (const role of ROLES) {
        const may = allowed.includes(role);
        it(`${name}: ${role} ${may ? "gets through" : "is refused"}`, async () => {
          reachedTransaction.mockClear();
          let status: number;
          try {
            status = (await call(mount(role))).status;
          } catch {
            status = -1;
          }
          if (may) {
            // Reads answer 200; writes pass the role check and stop at the stubbed transaction.
            if (name.startsWith("GET")) expect(status).toBe(200);
            else expect(reachedTransaction).toHaveBeenCalled();
          } else {
            expect(status).toBe(403);
            expect(reachedTransaction).not.toHaveBeenCalled();
          }
        });
      }
    }
  });

  describe("the bidder's and the seller's sides stay apart", () => {
    it("keeps staff accounts out of the bidder's routes", async () => {
      const app = mount("owner", "staff");
      for (const call of [
        () => send(app, "GET", "/reoffers"),
        () => send(app, "POST", `/reoffers/${OFFER}/accept`, { termsAccepted: true }),
      ]) {
        const res = await call();
        expect(res.status).toBe(403);
      }
      expect(reachedTransaction).not.toHaveBeenCalled();
    });

    it("answers an offer that is not this account's as not found, not forbidden", async () => {
      const res = await send(mount("owner"), "GET", `/reoffers/${OFFER}`);
      expect(res.status).toBe(404);
      expect(((await res.json()) as { error: string }).error).toBe("offer_not_found");
      const seller = await send(mount("owner"), "GET", `/reoffer-requests/${OFFER}`);
      expect(seller.status).toBe(404);
    });

    it("sends no-store on every answer", async () => {
      const res = await send(mount("owner"), "GET", "/reoffers");
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    });
  });

  describe("email links never accept (RA11)", () => {
    it("has no GET that accepts or declines, and the POST needs a body", async () => {
      const app = mount("owner");
      for (const path of [`/reoffers/${OFFER}/accept`, `/reoffers/${OFFER}/decline`]) {
        const res = await send(app, "GET", path);
        expect(res.status).toBe(404);
      }
      expect(reachedTransaction).not.toHaveBeenCalled();
      const bare = await send(app, "POST", `/reoffers/${OFFER}/accept`);
      expect([400, 422]).toContain(bare.status);
      expect(reachedTransaction).not.toHaveBeenCalled();
    });

    it("needs the terms box ticked: false, missing or another type is refused before any work", async () => {
      const app = mount("owner");
      for (const body of [
        { termsAccepted: false },
        {},
        { termsAccepted: "true" },
        { termsAccepted: 1 },
      ]) {
        const res = await send(app, "POST", `/reoffers/${OFFER}/accept`, body);
        expect([400, 422]).toContain(res.status);
      }
      expect(reachedTransaction).not.toHaveBeenCalled();
    });

    it("needs a signed-in session", async () => {
      const container = {
        userSuspensionChecker: { isSuspended: vi.fn() },
        requireLegalEntityContext: async (_c: unknown, next: () => Promise<void>) => next(),
        reoffer: {},
      } as unknown as ContainerReofferRoutesSlice;
      const authenticator: IAuthenticator = { getSessionUser: vi.fn().mockResolvedValue(null) };
      const app = new Hono();
      app.route("/legal-entities", createOrganisationReofferRoutes(container, authenticator));
      const res = await send(app, "POST", `/reoffers/${OFFER}/accept`, { termsAccepted: true });
      expect(res.status).toBe(401);
    });
  });

  describe("validation", () => {
    it.each([
      ["a non-uuid offer", "POST", "/reoffers/nope/accept", { termsAccepted: true }],
      [
        "a decline reason that is too long",
        "POST",
        `/reoffers/${OFFER}/decline`,
        { reason: "x".repeat(501) },
      ],
      [
        "an unknown field on decline",
        "POST",
        `/reoffers/${OFFER}/decline`,
        { reason: "x", price: 1 },
      ],
      [
        "a seller answer that is not yes or no",
        "POST",
        `/reoffer-requests/${OFFER}/answer`,
        { answer: "maybe" },
      ],
      [
        "a seller refusal without what to do with the lot",
        "POST",
        `/reoffer-requests/${OFFER}/answer`,
        { answer: "refused" },
      ],
      [
        "a seller yes with a preference",
        "POST",
        `/reoffer-requests/${OFFER}/answer`,
        { answer: "given", declinePreference: "later_sale" },
      ],
    ])("refuses %s", async (_label, method, path, body) => {
      reachedTransaction.mockClear();
      const res = await send(mount("owner"), method, path, body);
      expect([400, 422]).toContain(res.status);
      expect(reachedTransaction).not.toHaveBeenCalled();
    });
  });
});
