import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { OriginalMoveService } from "../../../application/admin/original-move.service.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";
import { moveAgreementsOver } from "../../../test-support/move-agreement-fixtures.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";
const REGISTER_ID = "44444444-4444-4444-8444-444444444444";
const SALE_ID = "55555555-5555-4555-8555-555555555555";
const LOT_ID = "66666666-6666-4666-8666-666666666666";
const PARTY_ID = "77777777-7777-4777-8777-777777777777";
const AGREEMENT_ID = "88888888-8888-4888-8888-888888888888";
const ARTWORK_ID = "99999999-9999-4999-8999-999999999999";

const ALL_ROLES: ShopStaffRole[] = [
  "shop_admin",
  "account_manager",
  "broker",
  "operations",
  "finance",
  "catalogue_editor",
  "editor",
  "read_only",
];
const CAN_CHECK: ShopStaffRole[] = ["shop_admin", "catalogue_editor", "read_only"];
const CAN_OFFER: ShopStaffRole[] = ["shop_admin", "catalogue_editor"];

const assessment = {
  registerId: REGISTER_ID,
  artworkId: null,
  title: "Tidal margin IV",
  stockCode: "LAX-ORI-AR-TM-26-0004",
  onLaxArt: false,
  laxArtDraft: false,
  draftLot: null,
  holdingLotId: null,
  eligible: true,
  zohoPrice: "4800.00",
  blockers: [],
  consignorAgreement: {
    place: "lax_bid",
    state: "in_force",
    outcome: "allowed",
    checkboxFallbackUntil: "2027-01-31",
    consignor: { partyId: PARTY_ID, displayName: "Example Gallery Ltd" },
    agreement: {
      id: AGREEMENT_ID,
      agreementId: AGREEMENT_ID,
      version: 1,
      places: ["lax_bid", "lax_art"],
      startsOn: "2026-03-03",
      endsOn: "2027-03-02",
      retiredOn: null,
    },
    lowestPricePence: 200_000,
    canAddAgreement: false,
  },
};
const body = { saleId: SALE_ID, startingPrice: "250.00", consignorAgreed: true };
const done = {
  lotId: LOT_ID,
  saleId: SALE_ID,
  saleTitle: "Winter sale",
  withdrawnFromLaxArt: false,
  created: true,
};

async function buildApp(role: ShopStaffRole) {
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  const deps = createMinimalShopApiTestDeps({
    env: { ...createMinimalShopApiTestDeps().env, SHOP_ADMIN_ENABLED: true },
    staffReader: {
      findActiveByIdentitySubject: async (subject: string) => ({
        roles: [role],
        identitySubjectId: subject,
      }),
      brokerCanAccessClientParty: async () => false,
    },
  });
  const offerRegisterAtAuction = vi.fn(async () => done);
  const invalidateCatalogue = vi.fn(async () => undefined);
  deps.admin.inventoryMoves = {
    ...deps.admin.inventoryMoves,
    assess: vi.fn(async () => ({ ...assessment, artworkId: ARTWORK_ID }) as never),
    assessRegister: vi.fn(async () => assessment as never),
    listSales: vi.fn(async () => ({ connected: true, sales: [] })),
    offerRegisterAtAuction,
  };
  deps.admin.artCache = { ...deps.admin.artCache, invalidateCatalogue } as never;
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();
  return { app, offerRegisterAtAuction, invalidateCatalogue };
}

const headers = { authorization: `Bearer ${ADMIN_TOKEN}` };
const url = `/admin/v1/artwork-register/${REGISTER_ID}/auction-offer`;
const offerUrl = `/admin/v1/artwork-register/${REGISTER_ID}/offer-at-auction`;

describe("Offer at auction from a From Zoho record: capabilities", () => {
  for (const role of ALL_ROLES) {
    const canCheck = CAN_CHECK.includes(role);
    it(`${canCheck ? "lets" : "stops"} ${role} check a record`, async () => {
      const { app } = await buildApp(role);
      const response = await app.inject({ method: "GET", url, headers });
      expect(response.statusCode).toBe(canCheck ? 200 : 403);
      await app.close();
    });

    it(`${canCheck ? "lets" : "stops"} ${role} read the open sales`, async () => {
      const { app } = await buildApp(role);
      const response = await app.inject({
        method: "GET",
        url: "/admin/v1/inventory/auction-sales",
        headers,
      });
      expect(response.statusCode).toBe(canCheck ? 200 : 403);
      await app.close();
    });

    const canOffer = CAN_OFFER.includes(role);
    it(`${canOffer ? "lets" : "stops"} ${role} make the draft lot`, async () => {
      const { app, offerRegisterAtAuction } = await buildApp(role);
      const response = await app.inject({ method: "POST", url: offerUrl, headers, payload: body });
      expect(response.statusCode).toBe(canOffer ? 200 : 403);
      expect(offerRegisterAtAuction).toHaveBeenCalledTimes(canOffer ? 1 : 0);
      await app.close();
    });
  }
});

describe("Offer at auction from a From Zoho record: routes", () => {
  it("answers the check with what the dialog shows", async () => {
    const { app } = await buildApp("catalogue_editor");
    const response = await app.inject({ method: "GET", url, headers });
    expect(response.json()).toMatchObject({
      eligible: true,
      registerId: REGISTER_ID,
      zohoPrice: "4800.00",
    });
    await app.close();
  });

  it("hands the staff member and the choices to the use case, and links the lot", async () => {
    const { app, offerRegisterAtAuction, invalidateCatalogue } = await buildApp("catalogue_editor");
    const response = await app.inject({ method: "POST", url: offerUrl, headers, payload: body });
    expect(response.json()).toEqual(done);
    expect(offerRegisterAtAuction).toHaveBeenCalledWith({
      registerId: REGISTER_ID,
      saleId: SALE_ID,
      startingPrice: "250.00",
      consignorAgreed: true,
      actorSubjectId: "catalogue_editor-subject",
    });
    expect(invalidateCatalogue).not.toHaveBeenCalled();
    await app.close();
  });

  it("takes a body without the checkbox, for a work an agreement covers", async () => {
    const { app, offerRegisterAtAuction } = await buildApp("catalogue_editor");
    const { consignorAgreed: _unused, ...withoutCheckbox } = body;
    const response = await app.inject({
      method: "POST",
      url: offerUrl,
      headers,
      payload: withoutCheckbox,
    });
    expect(response.statusCode).toBe(200);
    expect(offerRegisterAtAuction).toHaveBeenCalledWith(
      expect.objectContaining({ consignorAgreed: false }),
    );
    await app.close();
  });

  it.each(["shop_admin", "catalogue_editor"] as const)(
    "shows %s the consignor and the agreement, with Add agreement",
    async (role) => {
      const { app } = await buildApp(role);
      const response = await app.inject({ method: "GET", url, headers });
      expect(response.json().consignorAgreement).toMatchObject({
        state: "in_force",
        consignor: { displayName: "Example Gallery Ltd" },
        agreement: { id: AGREEMENT_ID },
        canAddAgreement: true,
      });
      await app.close();
    },
  );

  it.each([
    ["a From Zoho record", url],
    ["a lax.art original", `/admin/v1/artworks/${ARTWORK_ID}/auction-offer`],
  ])(
    "hides the consignor, the agreement and the lowest price from Read-only, for %s",
    async (_name, checkUrl) => {
      const { app } = await buildApp("read_only");
      const response = await app.inject({ method: "GET", url: checkUrl, headers });
      expect(response.statusCode).toBe(200);
      expect(response.json().consignorAgreement).toEqual({
        ...assessment.consignorAgreement,
        consignor: null,
        agreement: null,
        lowestPricePence: null,
        canAddAgreement: false,
      });
      await app.close();
    },
  );

  it.each([
    ["a From Zoho record", url],
    ["a lax.art original", `/admin/v1/artworks/${ARTWORK_ID}/auction-offer`],
  ])(
    "keeps the lowest price for someone who can make the move, for %s",
    async (_name, checkUrl) => {
      const { app } = await buildApp("catalogue_editor");
      const response = await app.inject({ method: "GET", url: checkUrl, headers });
      expect(response.json().consignorAgreement.lowestPricePence).toBe(200_000);
      await app.close();
    },
  );

  it("refreshes lax.art when a live listing was taken down", async () => {
    const { app, offerRegisterAtAuction, invalidateCatalogue } = await buildApp("shop_admin");
    offerRegisterAtAuction.mockResolvedValueOnce({ ...done, withdrawnFromLaxArt: true });
    await app.inject({ method: "POST", url: offerUrl, headers, payload: body });
    expect(invalidateCatalogue).toHaveBeenCalledWith("artworks");
    await app.close();
  });

  it.each([
    ["the sale", { ...body, saleId: "not-a-sale" }],
    ["the starting price", { ...body, startingPrice: "free" }],
    ["the consignor's agreement", { ...body, consignorAgreed: false }],
  ])("refuses a body with a bad %s", async (_name, payload) => {
    const { app, offerRegisterAtAuction } = await buildApp("catalogue_editor");
    const response = await app.inject({ method: "POST", url: offerUrl, headers, payload });
    expect(response.statusCode).toBe(400);
    expect(offerRegisterAtAuction).not.toHaveBeenCalled();
    await app.close();
  });

  it("refuses a record id that is not an id", async () => {
    const { app } = await buildApp("catalogue_editor");
    const response = await app.inject({
      method: "GET",
      url: "/admin/v1/artwork-register/nope/auction-offer",
      headers,
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });
});

/**
 * The real move service behind the routes, with no consignor set on the record and the clock at
 * `now`: the checkbox transition ends on 31 January 2027, a London day.
 */
async function buildAppWithClock(now: Date) {
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: "catalogue_editor-subject",
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: Math.floor(Date.now() / 1000),
    },
  } as never);
  const deps = createMinimalShopApiTestDeps({
    env: { ...createMinimalShopApiTestDeps().env, SHOP_ADMIN_ENABLED: true },
    staffReader: {
      findActiveByIdentitySubject: async (subject: string) => ({
        roles: ["catalogue_editor"],
        identitySubjectId: subject,
      }),
      brokerCanAccessClientParty: async () => false,
    },
  });
  const createDraftLot = vi.fn(async () => ({ lotId: LOT_ID, saleId: SALE_ID, created: true }));
  const register = {
    id: REGISTER_ID,
    zohoProductId: "z-1",
    kind: "original",
    stockCode: "LAX-ORI-AR-TM-26-0004",
    title: "Tidal margin IV",
    artist: { zohoArtistId: "7", name: "Ada Rowe", code: "AR" },
    medium: "Oil on linen",
    dimensions: "40 x 30 cm",
    year: 2024,
    imageRefs: ["z1.jpg"],
    catalogueStatus: "Available",
    offer: { state: "held", ref: null },
  };
  const service = new OriginalMoveService({
    originals: { findById: async () => null, findByZohoProductId: async () => null },
    register: {
      findById: async () => register as never,
      findByZohoProductId: async () => register as never,
    },
    history: { recordMoveConfirmed: vi.fn(async () => ({ status: "recorded" })) as never },
    auction: {
      listSales: async () => [
        { id: SALE_ID, title: "Spring sale", startsAt: "2027-03-01T10:00:00.000Z" },
      ],
      createDraftLot: createDraftLot as never,
      findDraftLot: async () => null,
      findLotCatalogue: async () => null,
      updateLotCatalogue: async () => {
        throw new Error("not used");
      },
    } as never,
    agreements: moveAgreementsOver({ consignor: null, now: () => now }),
    withdrawFromLaxArt: async () => undefined,
    resolveImageUrl: (value) => value ?? null,
    now: () => now,
  });
  deps.admin.inventoryMoves = service as never;
  const built = createShopApiApp({ deps, logger: false });
  await built.ready();
  return { app: built, createDraftLot };
}

describe("Offer at auction with no consignor set, on the London clock", () => {
  it.each([
    // 31 Jan 2027 in London: the last day the checkbox is the fallback.
    ["2027-01-31T23:30:00Z", "checkbox_fallback", 200],
    // 1 Feb 2027 in London: refused until a consignor is set.
    ["2027-02-01T00:30:00Z", "blocked", 409],
    ["2027-02-01T12:00:00Z", "blocked", 409],
  ] as const)(
    "at %s the check says %s and the move answers %i",
    async (instant, outcome, status) => {
      const { app, createDraftLot } = await buildAppWithClock(new Date(instant));
      const check = await app.inject({ method: "GET", url, headers });
      expect(check.json().consignorAgreement).toMatchObject({ state: "no_consignor", outcome });

      const response = await app.inject({ method: "POST", url: offerUrl, headers, payload: body });
      expect(response.statusCode).toBe(status);
      if (status !== 200) {
        expect(response.json().message).toBe("Set who consigned this work first.");
      }
      expect(createDraftLot).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
      await app.close();
    },
  );
});
