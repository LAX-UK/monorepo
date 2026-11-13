import { ok as domainOk } from "@auction/accounting-domain";
import { renderBidInvoicePdf } from "@auction/exports/documents";
import type { IBidInvoiceReader } from "@auction/persistence/interfaces";
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
import { PayPlanService } from "../services/organisation-buying/pay-plan.service.js";
import { PayProgressReadService } from "../services/organisation-buying/pay-progress-read.service.js";
import { PayProgressResolver } from "../services/organisation-buying/pay-progress.resolver.js";
import { PaySeveralService } from "../services/organisation-buying/pay-several.service.js";
import { PayTransferService } from "../services/organisation-buying/pay-transfer.service.js";
import { PurchaseCandidateReader } from "../services/organisation-buying/purchase-candidate.reader.js";
import { PurchaseInvoiceBooksService } from "../services/organisation-buying/purchase-invoice-books.service.js";
import { PurchaseInvoicePdfService } from "../services/organisation-buying/purchase-invoice-pdf.service.js";
import { PurchaseProblemService } from "../services/organisation-buying/purchase-problem.service.js";
import { InMemoryPurchaseProblems } from "../testing/in-memory-purchase-problems.js";
import {
  BUYING_ACCOUNT,
  InMemoryDeliveryQuotes,
  InMemoryPurchaseFacts,
  InMemoryRegistrations,
  LOTS,
  NOW,
  seedPurchases,
} from "../testing/in-memory-workspace-buying.js";
import { createOrganisationBuyingRoutes } from "./organisation-buying.js";

/** The stored copy of the invoice Books issued (live) for every purchase in these tests. */
const BOOKS_DOCUMENT = "dddddddd-0000-4000-8000-000000000001";
const STORED_PDF = Buffer.from("%PDF-1.4\n% stored Books copy\n%%EOF\n");

function mount(
  role: LegalEntityMemberRole,
  opts: {
    onboarded?: boolean;
    platformRole?: string;
    suspended?: boolean;
    signedOut?: boolean;
    /** A person acting on their own account, whose purchases are their own. */
    personal?: boolean;
    /** The account rule cannot be read. */
    eligibilityFails?: boolean;
  } = {},
) {
  const quotes = new InMemoryDeliveryQuotes();
  const purchases = new InMemoryPurchaseFacts(
    opts.personal
      ? seedPurchases().map((row) => ({ ...row, buyerAccountKind: "individual" as const }))
      : undefined,
    quotes,
  );
  const context: LegalEntityContext = {
    legalEntityId: BUYING_ACCOUNT,
    userId: `${role}-1`,
    role,
    isPrimaryAdmin: role === "owner",
  };
  const candidates = new PurchaseCandidateReader({
    reader: purchases,
    flags: { flagsFor: async () => new Map() },
    now: () => NOW,
  });
  const invoices: Pick<IBidInvoiceReader, "findByPaymentIds"> = {
    findByPaymentIds: async (ids) =>
      new Map(
        ids.map((id) => {
          const row = purchases.rows.find((r) => r.payment?.id === id);
          const pence = Math.round(Number(row?.payment?.amount ?? 0) * 100);
          return [
            id,
            {
              id: `inv-${id}`,
              number: `LAXB-${id.slice(-4)}`,
              raisedAt: new Date("2026-11-10T10:00:00Z"),
              totalPence: pence,
              dueAt: new Date("2026-11-25T23:59:59.999Z"),
              voidedAt: null,
              lines: [
                {
                  kind: "hammer",
                  label: "Hammer price",
                  ratePercent: null,
                  amountPence: pence,
                },
              ],
            } as never,
          ];
        }),
      ),
  };
  const payPlan = new PayPlanService({
    delivery: null,
    // Every live group counts as a payment the payer finished.
    progress: new PayProgressResolver({ checkoutStatus: async () => "complete" }),
    candidates,
    invoices,
    pricing: { price: async () => Promise.reject(new Error("not invoiced")) },
    lots: { findById: async () => null },
    accounts: {
      findById: async () =>
        ({
          id: BUYING_ACCOUNT,
          displayName: "Northbank Gallery",
          kind: opts.personal ? "individual" : "organisation",
        }) as never,
    },
    onboarding: { isComplete: async () => opts.onboarded ?? true },
    eligibility: {
      check: async () => {
        if (opts.eligibilityFails) throw new Error("db down");
        return { kind: "payable" as const };
      },
    },
    compliance: null,
    limits: {
      minPence: 30,
      cardMaxPence: 500_000,
      manualReviewMinPence: 2_500_000,
      absoluteMaxPence: 10_000_000,
    },
    issuer: {
      name: "London Auction Xchange LTD",
      address: "156 New Cavendish Street",
      companyNumber: null,
      vatNumber: null,
    },
    now: () => NOW,
  });
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(opts.suspended ?? false) },
    requireLegalEntityContext: async (
      c: { set: (key: string, value: LegalEntityContext) => void },
      next: () => Promise<void>,
    ) => {
      c.set("legalEntityContext", context);
      await next();
    },
    organisationBuying: {
      registrations: new AccountRegistrationsService(new InMemoryRegistrations()),
      purchases: new AccountPurchasesService({
        reader: purchases,
        stillToSend: { forPayments: async () => new Map() },
        now: () => NOW,
      }),
      payPlan,
      paySeveral: new PaySeveralService({
        planner: payPlan,
        invoices: { ensureForLot: async (lotId) => ({ created: false, lotId }) },
        limits: {
          minPence: 30,
          cardMaxPence: 500_000,
          manualReviewMinPence: 2_500_000,
          absoluteMaxPence: 10_000_000,
        },
        compliance: null,
        checkout: {
          start: async (input) =>
            ok({
              paymentGroupId: "group-1",
              checkoutUrl: "https://pay.example/g1",
              rail: input.rail,
            }),
        },
      }),
      payProgress: new PayProgressReadService({
        candidates,
        progress: new PayProgressResolver({ checkoutStatus: async () => "complete" }),
      }),
      invoicePdf: new PurchaseInvoicePdfService({
        candidates,
        invoices,
        accounts: {
          findById: async () =>
            ({ id: BUYING_ACCOUNT, displayName: "Northbank Gallery", legalName: null }) as never,
        },
        render: renderBidInvoicePdf,
        refunds: { sumRefundedPence: async () => ({ pence: 0, otherCurrencies: [] }) },
        metrics: { record: () => undefined },
        log: { warn: () => undefined },
      }),
      invoiceBooks: new PurchaseInvoiceBooksService({
        candidates,
        invoices,
        settings: {
          read: async () =>
            domainOk({
              bid: { xero: "off", books: "live" },
              shop: { xero: "off", books: "off" },
              lax_art: { xero: "off", books: "off" },
            }),
        },
        books: {
          read: async (invoiceId) =>
            domainOk({
              invoice: {
                id: invoiceId,
                raisedAt: new Date("2026-11-10T10:00:00Z"),
                voidedAt: null,
                totalPence: 100_010,
              },
              invoices: [
                {
                  documentId: BOOKS_DOCUMENT,
                  targetMode: "live" as const,
                  record: {
                    kind: "invoice",
                    reference: `LAX-BID-INV-${invoiceId}`,
                    attempts: 1,
                    status: "issued",
                    issued: { number: "INV-000123", providerId: "46", pdfRef: null },
                  },
                  grossPence: 100_010,
                  updatedAt: new Date("2026-11-12T14:05:00Z"),
                  copy: { storageKey: "accounting/x/doc.pdf", rehearsal: false },
                },
              ],
              creditNotes: [],
            }),
        },
        storage: { getObjectBytes: async () => STORED_PDF },
        now: () => NOW,
      }),
      payTransfer: new PayTransferService({
        candidates,
        progress: new PayProgressResolver({ checkoutStatus: async () => "complete" }),
        gateway: { bankTransferInstructions: async () => null },
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
        collectionPlaces: { findForLot: async () => null },
        purchases,
        places: { placeForLot: async () => null },
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
  },
  // The plan is for everyone who follows purchases; whether they pay is told by its gate.
  "GET /purchases/pay-plan": {
    call: (app) => app.request(`/legal-entities/purchases/pay-plan?lots=${LOTS.due}`),
    expected: {
      owner: 200,
      admin: 200,
      finance: 200,
      buyer_agent: 200,
      consignor: 403,
      viewer: 403,
    },
  },
  // Following a payment under way is for everyone who follows purchases.
  "GET /purchases/pay-progress": {
    call: (app) => app.request(`/legal-entities/purchases/pay-progress?lots=${LOTS.due}`),
    expected: {
      owner: 200,
      admin: 200,
      finance: 200,
      buyer_agent: 200,
      consignor: 403,
      viewer: 403,
    },
  },
  // The invoice is for the people who pay it.
  "GET /purchases/:lotId/invoice.pdf": {
    call: (app) => app.request(`/legal-entities/purchases/${LOTS.due}/invoice.pdf`),
    expected: {
      owner: 200,
      admin: 200,
      finance: 200,
      buyer_agent: 403,
      consignor: 403,
      viewer: 403,
    },
  },
  // The Books invoice card and its stored copies are for the people who pay, as the invoice is.
  "GET /purchases/:lotId/invoice-card": {
    call: (app) => app.request(`/legal-entities/purchases/${LOTS.due}/invoice-card`),
    expected: {
      owner: 200,
      admin: 200,
      finance: 200,
      buyer_agent: 403,
      consignor: 403,
      viewer: 403,
    },
  },
  "GET /purchases/:lotId/documents/:documentId": {
    call: (app) => app.request(`/legal-entities/purchases/${LOTS.due}/documents/${BOOKS_DOCUMENT}`),
    expected: {
      owner: 200,
      admin: 200,
      finance: 200,
      buyer_agent: 403,
      consignor: 403,
      viewer: 403,
    },
  },
  // Bank details are for the people who pay.
  "GET /purchases/pay-transfer": {
    call: (app) => app.request(`/legal-entities/purchases/pay-transfer?lots=${LOTS.due}`),
    expected: {
      owner: 200,
      admin: 200,
      finance: 200,
      buyer_agent: 403,
      consignor: 403,
      viewer: 403,
    },
  },
  // Paying several invoices at once is for the people who pay one: owners, admins and finance.
  "POST /purchases/pay-several": {
    call: (app) =>
      post(app, "/purchases/pay-several", {
        lotIds: [LOTS.due, LOTS.overdue],
        expectedTotalPence: 100_010,
        expectedLotIds: [LOTS.due, LOTS.overdue],
      }),
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

  describe("GET /purchases/pay-plan", () => {
    const plan = (app: Hono, lots: readonly string[]) =>
      app.request(`/legal-entities/purchases/pay-plan?lots=${lots.join(",")}`);

    it("answers with the plan, never cached", async () => {
      const res = await plan(mount("finance"), [LOTS.due, LOTS.overdue, LOTS.paid]);
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
      const { data } = (await res.json()) as {
        data: {
          gate: unknown;
          payable: { lotId: string; totalPence: number }[];
          leftOut: unknown[];
          totals: { pence: number };
          currency: string;
        };
      };
      expect(data.gate).toEqual({ kind: "clear" });
      expect(data.payable.map((p) => [p.lotId, p.totalPence])).toEqual([
        [LOTS.due, 60_010],
        [LOTS.overdue, 40_000],
      ]);
      expect(data.leftOut).toEqual([{ lotId: LOTS.paid, reason: "paid" }]);
      expect(data.totals.pence).toBe(100_010);
      expect(data.currency).toBe("GBP");
    });

    it("is for signed-in people only", async () => {
      const res = await plan(mount("finance", { signedOut: true }), [LOTS.due]);
      expect(res.status).toBe(401);
    });

    it("a staff account cannot plan a payment", async () => {
      const res = await plan(mount("finance", { platformRole: "admin" }), [LOTS.due]);
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ error: "bidding_not_allowed_for_role" });
    });

    it("a suspended account cannot plan a payment", async () => {
      const res = await plan(mount("finance", { suspended: true }), [LOTS.due]);
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: "account_suspended" });
    });

    it("an account that has not finished onboarding is told by the gate, and cannot pay", async () => {
      const app = mount("finance", { onboarded: false });
      const res = await plan(app, [LOTS.due]);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ data: { gate: { kind: "onboarding_required" } } });
      const pay = await post(app, "/purchases/pay-several", {
        lotIds: [LOTS.due],
        expectedTotalPence: 60_010,
        expectedLotIds: [LOTS.due],
      });
      expect(pay.status).toBe(403);
      expect(await pay.json()).toMatchObject({ code: "onboarding_required" });
    });

    it("a buyer agent sees the plan and who pays", async () => {
      const res = await plan(mount("buyer_agent"), [LOTS.agentWin]);
      expect(await res.json()).toMatchObject({
        data: {
          payerRole: "informed",
          gate: { kind: "not_payer", payingAccountName: "Northbank Gallery" },
        },
      });
    });

    it("a person on their own account plans and pays their own purchases", async () => {
      const app = mount("owner", { personal: true });
      const res = await plan(app, [LOTS.due, LOTS.overdue]);
      expect(await res.json()).toMatchObject({
        data: {
          account: { kind: "individual", name: "Northbank Gallery" },
          payerRole: "payer",
          gate: { kind: "clear" },
          totals: { pence: 100_010 },
        },
      });
      const pay = await post(app, "/purchases/pay-several", {
        lotIds: [LOTS.due, LOTS.overdue],
        expectedTotalPence: 100_010,
        expectedLotIds: [LOTS.due, LOTS.overdue],
      });
      expect(pay.status).toBe(200);
      expect(await pay.json()).toMatchObject({ data: { total: "1000.10", rail: "card" } });
    });

    it.each([
      ["no lots", []],
      ["a missing list", null],
    ])("refuses %s with 400", async (_name, lots) => {
      const url =
        lots === null
          ? "/legal-entities/purchases/pay-plan"
          : `/legal-entities/purchases/pay-plan?lots=${lots.join(",")}`;
      const res = await mount("finance").request(url);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "pay_several_empty" });
    });

    it("refuses more than 20 lots and the same lot twice, with their own codes", async () => {
      const app = mount("finance");
      const many = Array.from(
        { length: 21 },
        (_, i) => `aaaaaaaa-0000-4000-8000-0000000003${String(i).padStart(2, "0")}`,
      );
      const tooMany = await plan(app, many);
      expect(tooMany.status).toBe(400);
      expect(await tooMany.json()).toMatchObject({ error: "pay_several_too_many" });
      const twice = await plan(app, [LOTS.due, LOTS.due]);
      expect(twice.status).toBe(400);
      expect(await twice.json()).toMatchObject({ error: "pay_several_duplicate" });
    });

    it("refuses an id that is not a lot id", async () => {
      expect((await plan(mount("finance"), ["not-a-uuid"])).status).toBe(400);
    });

    it("answers 503 when a check cannot be read, never a plan that could be paid", async () => {
      const res = await plan(mount("finance", { eligibilityFails: true }), [LOTS.due]);
      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({ error: "pay_plan_unavailable" });
    });
  });

  describe("GET /purchases/:lotId/invoice.pdf", () => {
    const get = (role: LegalEntityMemberRole, lot: string, opts = {}) =>
      mount(role, opts).request(`/legal-entities/purchases/${lot}/invoice.pdf`);

    it("downloads a PDF the payer keeps, never cached", async () => {
      const res = await get("finance", LOTS.due);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/pdf");
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("content-disposition")).toMatch(
        /^attachment; filename="invoice-[A-Za-z0-9-]+\.pdf"$/,
      );
      const body = Buffer.from(await res.arrayBuffer());
      expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    });

    it("does not confirm the invoice of a lot that is another account's, or that does not exist", async () => {
      for (const lot of [LOTS.otherAccount, "aaaaaaaa-0000-4000-8000-0000000000ff"]) {
        const res = await get("finance", lot);
        expect(res.status).toBe(404);
        expect(await res.json()).toMatchObject({ error: "invoice_not_ready" });
      }
    });

    it("is for signed-in buyer accounts only", async () => {
      expect((await get("finance", LOTS.due, { signedOut: true })).status).toBe(401);
      expect((await get("finance", LOTS.due, { platformRole: "admin" })).status).toBe(403);
    });

    it("refuses an id that is not a lot id", async () => {
      expect((await get("finance", "nope")).status).toBe(400);
    });
  });

  describe("GET /purchases/:lotId/invoice-card and the stored copy", () => {
    it("tells the payer the Books number and where its stored copy is, never cached", async () => {
      const res = await mount("finance").request(
        `/legal-entities/purchases/${LOTS.due}/invoice-card`,
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(await res.json()).toMatchObject({
        data: {
          state: "issued",
          invoiceNumber: "INV-000123",
          issuedAt: "2026-11-12T14:05:00.000Z",
          invoiceDocumentId: BOOKS_DOCUMENT,
          cancelledAt: null,
          creditNotes: [],
        },
      });
    });

    it("downloads LAX's stored copy, and nothing it does not hold", async () => {
      const base = `/legal-entities/purchases/${LOTS.due}/documents`;
      const res = await mount("finance").request(`${base}/${BOOKS_DOCUMENT}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("application/pdf");
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("content-disposition")).toBe(
        'attachment; filename="invoice-INV-000123.pdf"',
      );
      expect(Buffer.from(await res.arrayBuffer())).toEqual(STORED_PDF);
      const other = await mount("finance").request(`${base}/dddddddd-0000-4000-8000-0000000000ff`);
      expect(other.status).toBe(404);
      expect((await mount("finance").request(`${base}/nope`)).status).toBe(400);
    });

    it("does not confirm the invoice of a lot that is another account's", async () => {
      const res = await mount("finance").request(
        `/legal-entities/purchases/${LOTS.otherAccount}/invoice-card`,
      );
      expect(res.status).toBe(404);
    });
  });

  describe("GET /purchases/pay-transfer", () => {
    it("answers with no details when no transfer is waiting, and is never cached", async () => {
      const res = await mount("finance").request(
        `/legal-entities/purchases/pay-transfer?lots=${LOTS.due}`,
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(await res.json()).toEqual({ data: { instructions: null } });
    });

    it("is for signed-in buyer accounts only", async () => {
      const url = `/legal-entities/purchases/pay-transfer?lots=${LOTS.due}`;
      expect((await mount("finance", { signedOut: true }).request(url)).status).toBe(401);
      expect((await mount("finance", { platformRole: "admin" }).request(url)).status).toBe(403);
    });

    it("refuses an id that is not a lot id", async () => {
      const res = await mount("finance").request(
        "/legal-entities/purchases/pay-transfer?lots=nope",
      );
      expect(res.status).toBe(400);
    });
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
      expectedTotalPence: 100_010,
      expectedLotIds: [LOTS.due, LOTS.overdue],
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
    // A request that names no plan (a page from before this check) is told the current one.
    const unshown = await post(mount("finance"), "/purchases/pay-several", {
      lotIds: [LOTS.due],
    });
    expect(unshown.status).toBe(409);
    expect(await unshown.json()).toMatchObject({
      error: "pay_plan_changed",
      plan: { total: "600.10" },
    });
  });

  it("answers 409 with the fresh plan when the plan shown is no longer the plan", async () => {
    const res = await post(mount("finance"), "/purchases/pay-several", {
      lotIds: [LOTS.due, LOTS.overdue],
      expectedTotalPence: 90_000,
      expectedLotIds: [LOTS.due, LOTS.overdue],
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      error: "pay_plan_changed",
      plan: { total: "1000.10", payable: [{ lotId: LOTS.due }, { lotId: LOTS.overdue }] },
    });
  });

  it("paying several needs completed account setup, as paying one does", async () => {
    const res = await post(mount("finance", { onboarded: false }), "/purchases/pay-several", {
      lotIds: [LOTS.due],
      expectedTotalPence: 60_010,
      expectedLotIds: [LOTS.due],
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "onboarding_required" });
  });

  it("a staff account can neither plan nor pay several invoices", async () => {
    const app = mount("finance", { platformRole: "admin" });
    for (const path of ["/purchases/pay-several/plan", "/purchases/pay-several"]) {
      const res = await post(app, path, {
        lotIds: [LOTS.due],
        expectedTotalPence: 60_010,
        expectedLotIds: [LOTS.due],
      });
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
