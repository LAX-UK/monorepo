import type { LegalEntityMemberRole } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { ContainerOrganisationSellingRoutesSlice } from "../container.js";
import type { LegalEntityContext } from "../middleware/require-legal-entity-context.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { AgreementDocumentService } from "../services/organisation-selling/agreement-document.service.js";
import { ReturnedWorksService } from "../services/organisation-selling/returned-works.service.js";
import { SoldAndPayoutsService } from "../services/organisation-selling/sold-and-payouts.service.js";
import { createOrganisationSellingRoutes } from "./organisation-selling.js";

const ACCOUNT = "11111111-1111-4111-8111-111111111111";
const SUBMISSION = "22222222-2222-4222-8222-222222222222";
const PAYOUT = "33333333-3333-4333-8333-333333333333";

function mount(role: LegalEntityMemberRole) {
  const context: LegalEntityContext = {
    legalEntityId: ACCOUNT,
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
    organisationSelling: {
      soldAndPayouts: new SoldAndPayoutsService({
        sold: { list: async () => [] },
        payouts: { find: async () => null },
      }),
      returnedWorks: new ReturnedWorksService({
        reader: { list: async () => [] },
        access: { senderFilter: () => undefined },
      }),
      agreementDocument: new AgreementDocumentService({
        facts: {
          factsFor: async () => ({
            submissionId: SUBMISSION,
            legalEntityId: ACCOUNT,
            workTitle: "Dusk",
            referenceNumber: 1042,
            sellerName: "Northbank Gallery",
          }),
        },
        agreements: {
          findBySubmissionId: async () =>
            ({
              currency: "GBP",
              estimateLow: null,
              estimateHigh: null,
              reservePrice: null,
              commissionPercent: null,
              termsVersion: "v1",
              proposedAt: new Date(),
              acceptedAt: null,
              acceptedByUserId: null,
            }) as never,
        },
        people: { namesFor: async () => new Map() },
        access: { hides: async () => false },
        render: async () => Buffer.from("%PDF-1.3"),
      }),
    },
  } as unknown as ContainerOrganisationSellingRoutesSlice;
  const authenticator: IAuthenticator = {
    getSessionUser: vi
      .fn()
      .mockResolvedValue({ id: context.userId, role: "client", scopes: ["bid.read", "bid.write"] }),
  };
  const app = new Hono();
  app.route("/legal-entities", createOrganisationSellingRoutes(container, authenticator));
  return app;
}

const MATRIX: Record<string, { path: string; expected: Record<LegalEntityMemberRole, number> }> = {
  "GET /sold": {
    path: "/legal-entities/sold",
    expected: {
      owner: 200,
      admin: 200,
      finance: 200,
      consignor: 403,
      viewer: 403,
      buyer_agent: 403,
    },
  },
  "GET /sold/export.csv": {
    path: "/legal-entities/sold/export.csv?year=2026",
    expected: {
      owner: 200,
      admin: 200,
      finance: 200,
      consignor: 403,
      viewer: 403,
      buyer_agent: 403,
    },
  },
  "GET /payouts/:id/lines": {
    path: `/legal-entities/payouts/${PAYOUT}/lines`,
    expected: {
      owner: 404,
      admin: 404,
      finance: 404,
      consignor: 403,
      viewer: 403,
      buyer_agent: 403,
    },
  },
  "GET /collection/returned": {
    path: "/legal-entities/collection/returned",
    expected: {
      owner: 200,
      admin: 200,
      finance: 200,
      consignor: 200,
      viewer: 200,
      buyer_agent: 403,
    },
  },
  "GET /consignments/:id/agreement.pdf": {
    path: `/legal-entities/consignments/${SUBMISSION}/agreement.pdf`,
    expected: {
      owner: 200,
      admin: 200,
      finance: 200,
      consignor: 200,
      viewer: 200,
      buyer_agent: 403,
    },
  },
};

describe("organisation selling routes: capability matrix", () => {
  for (const [endpoint, { path, expected }] of Object.entries(MATRIX)) {
    for (const [role, status] of Object.entries(expected)) {
      it(`${endpoint} answers ${status} for ${role}`, async () => {
        const res = await mount(role as LegalEntityMemberRole).request(path);
        expect(res.status).toBe(status);
      });
    }
  }
});

describe("organisation selling routes", () => {
  it("sends the agreement as a PDF download named after its reference", async () => {
    const res = await mount("owner").request(
      `/legal-entities/consignments/${SUBMISSION}/agreement.pdf`,
    );
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="consignment-agreement-C-1042.pdf"',
    );
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("%PDF-1.3");
  });

  it("rejects a malformed id before any service runs", async () => {
    const res = await mount("owner").request("/legal-entities/payouts/not-a-uuid/lines");
    expect(res.status).toBe(400);
  });
});
