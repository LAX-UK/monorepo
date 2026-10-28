import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import {
  FULFILMENT_CARRIER_MAX_LENGTH,
  FULFILMENT_TRACKING_NUMBER_MAX_LENGTH,
  PAYOUT_PAID_REFERENCE_MAX_LENGTH,
  SALE_AUTHORITY_NOTE_MAX_LENGTH,
  SHOP_API_ERROR_CODES,
} from "@auction/shop-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import type { AdminRoutesDeps } from "../../../admin-route-deps.js";
import { createShopApiApp } from "../../../app.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";
const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const ARTWORK_ID = "22222222-2222-4222-8222-222222222222";
const OWNER_ID = "33333333-3333-4333-8333-333333333333";
const EDITION_ID = "44444444-4444-4444-8444-444444444444";
const FEE_ID = "55555555-5555-4555-8555-555555555555";
const SELLER_ID = "66666666-6666-4666-8666-666666666666";
const BUYER_ID = "77777777-7777-4777-8777-777777777777";
const FULFILMENT_ID = "88888888-8888-4888-8888-888888888888";
const PAYOUT_ID = "99999999-9999-4999-8999-999999999999";
const SALE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const KEY = "idem-key-0001";

const ALL_ROLES: ShopStaffRole[] = [
  "shop_admin",
  "account_manager",
  "broker",
  "operations",
  "finance",
  "catalogue_editor",
];
const CAN_DECIDE_AUTHORITY: ShopStaffRole[] = ["shop_admin", "account_manager"];

async function buildApp(
  role: ShopStaffRole,
  options: { authAgeSeconds?: number; admin?: Partial<AdminRoutesDeps> } = {},
) {
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000) - (options.authAgeSeconds ?? 0),
    },
  } as never);
  const base = createMinimalShopApiTestDeps();
  const deps = createMinimalShopApiTestDeps({
    env: {
      ...base.env,
      SHOP_ADMIN_ENABLED: true,
      SHOP_PAYOUTS_ENABLED: true,
      SHOP_THIRD_PARTY_ENABLED: true,
      SHOP_ORIGINALS_ENABLED: true,
    },
    staffReader: {
      findActiveByIdentitySubject: async (subject: string) =>
        subject === `${role}-subject` ? { roles: [role], identitySubjectId: subject } : null,
      brokerCanAccessClientParty: async () => false,
    },
  });
  Object.assign(deps.admin, options.admin ?? {});
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();
  return app;
}

const headers = (key: string | undefined = KEY) => ({
  authorization: `Bearer ${ADMIN_TOKEN}`,
  ...(key ? { "idempotency-key": key } : {}),
});

const decisionUrl = `/admin/v1/sale-authority-requests/${REQUEST_ID}/decision`;

describe("sale-authority decision", () => {
  const cases = ALL_ROLES.flatMap((role) =>
    (["approve", "decline"] as const).map((decision) => ({
      role,
      decision,
      allowed: CAN_DECIDE_AUTHORITY.includes(role),
    })),
  );

  it.each(cases)("$decision as $role is allowed: $allowed", async ({ role, decision, allowed }) => {
    const app = await buildApp(role);
    const response = await app.inject({
      method: "POST",
      url: decisionUrl,
      headers: headers(),
      payload:
        decision === "approve"
          ? { decision, authorisedCount: 1, evidenceNote: "Certificate seen" }
          : { decision, declineReason: "No proof of ownership" },
    });
    expect(response.statusCode).toBe(allowed ? 200 : 403);
    await app.close();
  });

  it.each(["approve", "decline"] as const)("%s needs a recent sign-in", async (decision) => {
    const app = await buildApp("shop_admin", { authAgeSeconds: 3600 });
    const response = await app.inject({
      method: "POST",
      url: decisionUrl,
      headers: headers(),
      payload:
        decision === "approve"
          ? { decision, evidenceNote: "Certificate seen" }
          : { decision, declineReason: "No proof" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe(SHOP_API_ERROR_CODES.STEP_UP_REQUIRED);
    await app.close();
  });

  it("rejects an evidence note over the limit", async () => {
    const app = await buildApp("shop_admin");
    const response = await app.inject({
      method: "POST",
      url: decisionUrl,
      headers: headers(),
      payload: {
        decision: "approve",
        evidenceNote: "x".repeat(SALE_AUTHORITY_NOTE_MAX_LENGTH + 1),
      },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it.each([{}, { declineReason: "   " }])(
    "refuses a decline without a reason the seller can read (%o)",
    async (reason) => {
      const rejectSaleAuthorityRequest = vi.fn(async () => ({
        requestId: REQUEST_ID,
        status: "rejected" as const,
      }));
      const app = await buildApp("shop_admin", { admin: { rejectSaleAuthorityRequest } });
      const response = await app.inject({
        method: "POST",
        url: decisionUrl,
        headers: headers(),
        payload: { decision: "decline", ...reason },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe(SHOP_API_ERROR_CODES.VALIDATION);
      expect(rejectSaleAuthorityRequest).not.toHaveBeenCalled();
      await app.close();
    },
  );

  it("passes the trimmed decline reason through", async () => {
    const rejectSaleAuthorityRequest = vi.fn(async () => ({
      requestId: REQUEST_ID,
      status: "rejected" as const,
    }));
    const app = await buildApp("shop_admin", { admin: { rejectSaleAuthorityRequest } });
    await app.inject({
      method: "POST",
      url: decisionUrl,
      headers: headers(),
      payload: { decision: "decline", declineReason: "  We need the signed agreement.  " },
    });
    expect(rejectSaleAuthorityRequest).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "We need the signed agreement." }),
    );
    await app.close();
  });

  it("rejects a decline reason over the limit", async () => {
    const app = await buildApp("shop_admin");
    const response = await app.inject({
      method: "POST",
      url: decisionUrl,
      headers: headers(),
      payload: {
        decision: "decline",
        declineReason: "x".repeat(SALE_AUTHORITY_NOTE_MAX_LENGTH + 1),
      },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("passes the key and the actor to the grant and the decline", async () => {
    const grantSaleAuthority = vi.fn(async () => ({
      grantId: "g",
      artworkId: ARTWORK_ID,
      ownerPartyId: OWNER_ID,
      authorisedCount: 1,
      editionNumbersAuthorised: [],
      editionNumbersRevoked: [],
    }));
    const rejectSaleAuthorityRequest = vi.fn(async () => ({
      requestId: REQUEST_ID,
      status: "rejected" as const,
    }));
    const app = await buildApp("shop_admin", {
      admin: { grantSaleAuthority, rejectSaleAuthorityRequest },
    });
    await app.inject({
      method: "POST",
      url: decisionUrl,
      headers: headers(),
      payload: { decision: "approve", evidenceNote: "Certificate seen" },
    });
    expect(grantSaleAuthority).toHaveBeenCalledWith(expect.anything(), {
      idempotencyKey: KEY,
      actorSubjectId: "shop_admin-subject",
    });
    await app.inject({
      method: "POST",
      url: decisionUrl,
      headers: headers("idem-key-0002"),
      payload: { decision: "decline", declineReason: "No proof" },
    });
    expect(rejectSaleAuthorityRequest).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: "idem-key-0002" }),
    );
    await app.close();
  });

  it("requires an Idempotency-Key", async () => {
    const app = await buildApp("shop_admin");
    const response = await app.inject({
      method: "POST",
      url: decisionUrl,
      headers: headers(""),
      payload: { decision: "decline", declineReason: "No proof" },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });
});

describe("Idempotency-Key header", () => {
  const post = (key: string) => ({
    method: "POST" as const,
    url: decisionUrl,
    headers: headers(key),
    payload: { decision: "decline", declineReason: "No proof" },
  });

  it("rejects a key over 128 characters", async () => {
    const app = await buildApp("shop_admin");
    expect((await app.inject(post("k".repeat(129)))).statusCode).toBe(400);
    expect((await app.inject(post("k".repeat(128)))).statusCode).toBe(200);
    await app.close();
  });

  it("rejects a key with spaces or control characters", async () => {
    const app = await buildApp("shop_admin");
    expect((await app.inject(post("two words here"))).statusCode).toBe(400);
    await app.close();
  });
});

describe("writes hand their key to the writer", () => {
  it("sale-authority grant on an artwork needs step-up and passes the key", async () => {
    const grantSaleAuthority = vi.fn(async () => ({
      grantId: "g",
      artworkId: ARTWORK_ID,
      ownerPartyId: OWNER_ID,
      authorisedCount: 1,
      editionNumbersAuthorised: [],
      editionNumbersRevoked: [],
    }));
    const payload = { ownerPartyId: OWNER_ID, authorisedCount: 1, evidenceNote: "Certificate" };
    const url = `/admin/v1/artworks/${ARTWORK_ID}/sale-authority`;

    const stale = await buildApp("shop_admin", {
      authAgeSeconds: 3600,
      admin: { grantSaleAuthority },
    });
    const refused = await stale.inject({ method: "POST", url, headers: headers(), payload });
    expect(refused.statusCode).toBe(403);
    expect(grantSaleAuthority).not.toHaveBeenCalled();
    await stale.close();

    const app = await buildApp("shop_admin", { admin: { grantSaleAuthority } });
    const ok = await app.inject({ method: "POST", url, headers: headers(), payload });
    expect(ok.statusCode).toBe(200);
    expect(grantSaleAuthority).toHaveBeenCalledWith(expect.anything(), {
      idempotencyKey: KEY,
      actorSubjectId: "shop_admin-subject",
    });
    await app.close();
  });

  it("artwork import passes the key", async () => {
    const importArtwork = vi.fn(async () => ({
      artworkId: ARTWORK_ID,
      created: true,
      editionCount: 0,
    }));
    const app = await buildApp("catalogue_editor", { admin: { importArtwork } });
    const response = await app.inject({
      method: "POST",
      url: "/admin/v1/artworks/import",
      headers: headers(),
      payload: {
        importKey: "import-1",
        slug: "untitled",
        title: "Untitled",
        description: null,
        primaryImageUrl: null,
        artistSlug: "artist",
        artistDisplayName: "Artist",
        eligibleForEditionAllocation: false,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(importArtwork).toHaveBeenCalledWith(expect.anything(), {
      idempotencyKey: KEY,
      actorSubjectId: "catalogue_editor-subject",
    });
    await app.close();
  });

  it("third-party sale, fee approval, original sale and hold release pass the key", async () => {
    const recordSale = vi.fn(async () => ({ saleId: SALE_ID, status: "draft" as const }));
    const approveFee = vi.fn(async () => ({ feeId: FEE_ID, status: "approved" as const }));
    const createReservation = vi.fn(async () => ({
      originalSaleId: SALE_ID,
      status: "reserved" as const,
    }));
    const releaseHold = vi.fn(async () => ({ holdId: SALE_ID, status: "released" as const }));
    const app = await buildApp("shop_admin", {
      admin: {
        thirdPartySales: { recordSale },
        saleFees: { approveFee },
        originalSales: {
          createReservation,
          issueInvoice: vi.fn(),
          completePaidAndAssign: vi.fn(),
        } as never,
        stockHolds: { releaseHold },
      },
    });
    const ctx = { idempotencyKey: KEY, actorSubjectId: "shop_admin-subject" };
    const call = (url: string, payload?: Record<string, unknown>) =>
      app.inject({ method: "POST", url, headers: headers(), ...(payload ? { payload } : {}) });

    expect(
      (
        await call("/admin/v1/third-party-sales", {
          editionId: EDITION_ID,
          sellerPartyId: SELLER_ID,
          buyerPartyId: BUYER_ID,
          grossPence: 100,
        })
      ).statusCode,
    ).toBe(200);
    expect(recordSale).toHaveBeenCalledWith(expect.anything(), ctx);

    expect(
      (await call(`/admin/v1/sale-fees/${FEE_ID}/approve`, { feeId: FEE_ID })).statusCode,
    ).toBe(200);
    expect(approveFee).toHaveBeenCalledWith(expect.anything(), ctx);

    expect(
      (
        await call("/admin/v1/original-sales", {
          artworkId: ARTWORK_ID,
          buyerPartyId: BUYER_ID,
          salePricePence: 100,
        })
      ).statusCode,
    ).toBe(200);
    expect(createReservation).toHaveBeenCalledWith(expect.anything(), ctx);

    expect((await call(`/admin/v1/holds/${SALE_ID}/release`)).statusCode).toBe(200);
    expect(releaseHold).toHaveBeenCalledWith(expect.anything(), ctx);
    await app.close();
  });

  it("issuing an original-sale invoice needs step-up", async () => {
    const app = await buildApp("shop_admin", { authAgeSeconds: 3600 });
    const response = await app.inject({
      method: "POST",
      url: `/admin/v1/original-sales/${SALE_ID}/invoice`,
      headers: headers(),
      payload: { buyerEmail: "buyer@example.com" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe(SHOP_API_ERROR_CODES.STEP_UP_REQUIRED);
    await app.close();
  });

  it("a fee approval error from the writer is returned as is", async () => {
    const { ShopApiError } = await import("../../../errors/shop-api-error.js");
    const approveFee = vi.fn(async () => {
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.CONFLICT,
        "Sale fee is not pending approval",
        409,
      );
    });
    const app = await buildApp("finance", { admin: { saleFees: { approveFee } } });
    const response = await app.inject({
      method: "POST",
      url: `/admin/v1/sale-fees/${FEE_ID}/approve`,
      headers: headers(),
      payload: { feeId: FEE_ID },
    });
    expect(response.statusCode).toBe(409);
    await app.close();
  });
});

describe("fulfilment and payout field limits", () => {
  const fulfilment = (extra: Record<string, unknown>) => ({
    method: "PATCH" as const,
    url: "/admin/v1/fulfilment",
    headers: headers(),
    payload: { fulfilmentId: FULFILMENT_ID, status: "shipped", ...extra },
  });

  it("accepts a normal tracking number and carrier", async () => {
    const app = await buildApp("operations");
    const response = await app.inject(
      fulfilment({ carrier: "Royal Mail", trackingNumber: "AB 1234-5678 GB" }),
    );
    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it.each([
    ["markup", "<script>alert(1)</script>"],
    ["a link", "https://evil.example/x"],
    ["a line break", "AB123\nBcc: someone"],
    ["a slash", "AB/123"],
    ["a query", "AB123?x=1"],
    ["a leading space", " AB123"],
  ])("rejects a tracking number with %s", async (_label, trackingNumber) => {
    const app = await buildApp("operations");
    const response = await app.inject(fulfilment({ trackingNumber }));
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("rejects a tracking number and carrier over the limit", async () => {
    const app = await buildApp("operations");
    const longTracking = await app.inject(
      fulfilment({ trackingNumber: "A".repeat(FULFILMENT_TRACKING_NUMBER_MAX_LENGTH + 1) }),
    );
    expect(longTracking.statusCode).toBe(400);
    const longCarrier = await app.inject(
      fulfilment({ carrier: "C".repeat(FULFILMENT_CARRIER_MAX_LENGTH + 1) }),
    );
    expect(longCarrier.statusCode).toBe(400);
    await app.close();
  });

  it("rejects a paid reference over the limit", async () => {
    const app = await buildApp("finance");
    const post = (paidReference: string) =>
      app.inject({
        method: "POST",
        url: "/admin/v1/payouts/mark-paid",
        headers: headers(),
        payload: { payoutId: PAYOUT_ID, paidReference },
      });
    expect((await post("R".repeat(PAYOUT_PAID_REFERENCE_MAX_LENGTH + 1))).statusCode).toBe(400);
    expect((await post("R".repeat(PAYOUT_PAID_REFERENCE_MAX_LENGTH))).statusCode).toBe(200);
    await app.close();
  });
});
