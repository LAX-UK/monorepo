import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";
const REGISTER_ID = "44444444-4444-4444-8444-444444444444";
const SALE_ID = "55555555-5555-4555-8555-555555555555";
const LOT_ID = "66666666-6666-4666-8666-666666666666";

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
  blockers: [],
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
    expect(response.json()).toMatchObject({ eligible: true, registerId: REGISTER_ID });
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
      actorSubjectId: "catalogue_editor-subject",
    });
    expect(invalidateCatalogue).not.toHaveBeenCalled();
    await app.close();
  });

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
