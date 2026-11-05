import type { LegalEntityMemberRole } from "@auction/types";
import { Hono } from "hono";
import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { ContainerOrganisationBuyingRoutesSlice } from "../container.js";
import { createRequireAccountOnboarding } from "../middleware/require-account-onboarding.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { AccountPurchasesService } from "../services/organisation-buying/account-purchases.service.js";
import { AccountRegistrationsService } from "../services/organisation-buying/account-registrations.service.js";
import { CollectionBookingService } from "../services/organisation-buying/collection-booking.service.js";
import { DeliveryQuoteService } from "../services/organisation-buying/delivery-quote.service.js";
import { PaySeveralService } from "../services/organisation-buying/pay-several.service.js";
import { PurchaseProblemService } from "../services/organisation-buying/purchase-problem.service.js";
import { InMemoryPurchaseProblems } from "../testing/in-memory-purchase-problems.js";
import {
  BUYING_ACCOUNT,
  InMemoryDeliveryQuotes,
  InMemoryPurchaseFacts,
  InMemoryRegistrations,
  LOTS,
  NOW,
} from "../testing/in-memory-workspace-buying.js";
import { createOrganisationBuyingRoutes } from "./organisation-buying.js";

function mount(
  role: LegalEntityMemberRole,
  opts: { onboarded?: boolean; platformRole?: string } = {},
) {
  const quotes = new InMemoryDeliveryQuotes();
  const purchases = new InMemoryPurchaseFacts(undefined, quotes);
  const context: LegalEntityContext = {
    legalEntityId: BUYING_ACCOUNT,
    userId: `${role}-1`,
    role,
    isPrimaryAdmin: role === "owner",
  };
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    requireLegalEntityContext: async (
      c: { set: (key: string, value: LegalEntityContext) => void },
      next: () => Promise<void>,
    ) => {
      c.set("legalEntityContext", context);
      await next();
    },
    organisationBuying: {
      registrations: new AccountRegistrationsService(new InMemoryRegistrations()),
      purchases: new AccountPurchasesService({ reader: purchases, now: () => NOW }),
      paySeveral: new PaySeveralService({
        reader: purchases,
        flags: { flagsFor: async () => new Map() },
        limits: {
          minPence: 30,
          cardMaxPence: 500_000,
          manualReviewMinPence: 2_500_000,
          absoluteMaxPence: 10_000_000,
        },
        compliance: null,
        eligibility: { check: async () => ({ kind: "payable" as const }) },
        checkout: {
          start: async (input) =>
            ok({
              paymentGroupId: "group-1",
              checkoutUrl: "https://pay.example/g1",
              rail: input.rail,
            }),
        },
        now: () => NOW,
      }),
      deliveryQuotes: new DeliveryQuoteService({ quotes, purchases }),
      problems: new PurchaseProblemService({
        purchases,
        problems: new InMemoryPurchaseProblems(),
        transactionRunner: { runInTransaction: (fn) => fn({} as never) },
        events: {
          publish: async () => undefined,
          withTx() {
            return this;
          },
        },
        now: () => NOW,
      }),
      collection: new CollectionBookingService({
        settings: {
          selfServeEnabled: false,
          slotCapacityPerHour: null,
          hours: null,
          bookingEmail: "info@lax.bid",
        },
        purchases,
        places: { placeForLot: async () => null },
      }),
    },
  } as unknown as ContainerOrganisationBuyingRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({
      id: context.userId,
      role: opts.platformRole ?? "client",
      scopes: ["bid.read", "bid.write"],
    }),
  };
  const app = new Hono();
  const onboarding = createRequireAccountOnboarding({
    isComplete: async () => opts.onboarded ?? true,
  });
  app.route(
    "/legal-entities",
    createOrganisationBuyingRoutes(container, authenticator, onboarding),
  );
  return app;
}

const post = (app: Hono, path: string, json: unknown) =>
  app.request(`/legal-entities${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(json),
  });

/** Status per role for each endpoint: the capability matrix, as the routes answer it. */
const MATRIX: Record<
  string,
  {
    call: (app: Hono) => Response | Promise<Response>;
    expected: Record<LegalEntityMemberRole, number>;
  }
> = {
  "GET /registrations": {
    call: (app) => app.request("/legal-entities/registrations"),
    expected: {
      owner: 200,
      admin: 200,
      buyer_agent: 200,
      finance: 403,
      consignor: 403,
      viewer: 403,
    },
  },
  "GET /purchases": {
    call: (app) => app.request("/legal-entities/purchases"),
    expected: {
      owner: 200,
      admin: 200,
      finance: 200,
      buyer_agent: 200,
      consignor: 403,
      viewer: 403,
    },
  },
  "GET /purchases/export.csv": {
    call: (app) => app.request("/legal-entities/purchases/export.csv"),
    expected: {
      owner: 200,
      admin: 200,
      finance: 200,
      buyer_agent: 200,
      consignor: 403,
      viewer: 403,
    },
  },
  "POST /purchases/:lotId/problem": {
    call: (app) =>
      post(app, `/purchases/${LOTS.paid}/problem`, {
        category: "damaged",
        message: "The frame arrived cracked.",
      }),
    // A buyer agent follows only the lots they won, and this one was won by the owner.
    expected: {
      owner: 200,
      admin: 200,
      finance: 200,
      buyer_agent: 404,
      consignor: 403,
      viewer: 403,
    },
  },
  "POST /purchases/:lotId/delivery-quote": {
    call: (app) =>
      post(app, `/purchases/${LOTS.paid}/delivery-quote`, { destination: "12 Gallery Row" }),
    expected: {
      owner: 200,
      admin: 200,
      finance: 200,
      buyer_agent: 403,
      consignor: 403,
      viewer: 403,
    },
  }, // Paying several invoices at once is for the people who pay one: owners, admins and finance.
  "POST /purchases/pay-several": {
    call: (app) => post(app, "/purchases/pay-several", { lotIds: [LOTS.due, LOTS.overdue] }),
    expected: {
      owner: 200,
      admin: 200,
      finance: 200,
      buyer_agent: 403,
      consignor: 403,
      viewer: 403,
    },
  },
};

describe("organisation buying routes: capability matrix", () => {
  for (const [endpoint, { call, expected }] of Object.entries(MATRIX)) {
    for (const [role, status] of Object.entries(expected)) {
      it(`${endpoint} answers ${status} for ${role}`, async () => {
        const res = await call(mount(role as LegalEntityMemberRole));
        expect(res.status).toBe(status);
      });
    }
  }
});

describe("organisation buying routes", () => {
  it("returns purchases with their invoice and delivery stage", async () => {
    const res = await mount("finance").request("/legal-entities/purchases?limit=2");
    const body = (await res.json()) as {
      data: { items: { invoice: { status: string } }[]; nextOffset: number | null };
    };
    expect(body.data.items).toHaveLength(2);
    expect(body.data.nextOffset).toBe(2);
  });

  it("sends the export as a CSV download", async () => {
    const res = await mount("owner").request("/legal-entities/purchases/export.csv");
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="purchases-/);
  });

  it("plans pay several and rejects malformed picks before the rule runs", async () => {
    const app = mount("finance");
    const plan = await post(app, "/purchases/pay-several/plan", {
      lotIds: [LOTS.due, LOTS.overdue],
    });
    expect(plan.status).toBe(200);
    expect(await plan.json()).toMatchObject({ data: { total: "1000.10", currency: "GBP" } });
    expect((await post(app, "/purchases/pay-several/plan", { lotIds: ["nope"] })).status).toBe(400);
    expect((await post(app, "/purchases/pay-several/plan", { lotIds: [] })).status).toBe(400);
  });

  it("opens one checkout for several invoices and says what it covers", async () => {
    const res = await post(mount("finance"), "/purchases/pay-several", {
      lotIds: [LOTS.due, LOTS.overdue, LOTS.paid],
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      data: {
        paymentGroupId: "group-1",
        checkoutUrl: "https://pay.example/g1",
        rail: "card",
        total: "1000.10",
        skipped: [{ lotId: LOTS.paid, reason: "not_owed" }],
      },
    });
    const malformed = await post(mount("finance"), "/purchases/pay-several", { lotIds: [] });
    expect(malformed.status).toBe(400);
  });

  it("paying several needs completed account setup, as paying one does", async () => {
    const res = await post(mount("finance", { onboarded: false }), "/purchases/pay-several", {
      lotIds: [LOTS.due],
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "onboarding_required" });
  });

  it("a staff account can neither plan nor pay several invoices", async () => {
    const app = mount("finance", { platformRole: "admin" });
    for (const path of ["/purchases/pay-several/plan", "/purchases/pay-several"]) {
      const res = await post(app, path, { lotIds: [LOTS.due] });
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ error: "bidding_not_allowed_for_role" });
    }
  });

  it("reports a problem once, and reading it back shows the same reference", async () => {
    const app = mount("owner");
    const body = { category: "not_received", message: "It has not arrived." };
    const first = await post(app, `/purchases/${LOTS.paid}/problem`, body);
    const again = await post(app, `/purchases/${LOTS.paid}/problem`, body);
    const read = await app.request(`/legal-entities/purchases/${LOTS.paid}/problem`);
    type Body = { data: unknown };
    const [one, two, current] = (await Promise.all([first.json(), again.json(), read.json()])) as [
      Body,
      Body,
      Body,
    ];
    expect(one.data).toMatchObject({ created: true, problem: { reference: "PR-3F2A9C1E" } });
    expect(two.data).toMatchObject({ created: false, problem: { reference: "PR-3F2A9C1E" } });
    expect(current.data).toMatchObject({ reference: "PR-3F2A9C1E", status: "open" });
  });

  it("rejects a report with no category or a too-short message, and an unpaid purchase", async () => {
    const app = mount("owner");
    expect(
      (await post(app, `/purchases/${LOTS.paid}/problem`, { category: "nope", message: "x" }))
        .status,
    ).toBe(400);
    const unpaid = await post(app, `/purchases/${LOTS.due}/problem`, {
      category: "other",
      message: "Something is wrong.",
    });
    expect(unpaid.status).toBe(409);
    expect(await unpaid.json()).toMatchObject({ error: "problem_purchase_not_paid" });
  });

  it("answers a stale quote step with a conflict", async () => {
    const res = await post(mount("owner"), `/purchases/${LOTS.paid}/delivery-quote/accept`, {});
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "quote_step_not_allowed" });
  });

  it("says how to book a collection", async () => {
    const res = await mount("owner").request(`/legal-entities/purchases/${LOTS.paid}/collection`);
    expect(await res.json()).toMatchObject({ data: { kind: "email", email: "info@lax.bid" } });
  });
});
