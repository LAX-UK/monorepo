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
const ARTIST_ID = "66666666-6666-4666-8666-666666666666";
const ARTWORK_ID = "77777777-7777-4777-8777-777777777777";

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
  title: "Tidal margin IV",
  stockCode: "LAX-ORI-AR-TM-26-0004",
  artistName: "Ada Rowe",
  artistCode: "AR",
  medium: "Oil on linen",
  dimensions: null,
  year: 2024,
  imageCount: 0,
  missing: ["image", "size"],
  matchedArtist: null,
  existing: null,
  eligible: true,
  zohoPrice: "4800.00",
  blockers: [],
};

const offerBody = { artistId: ARTIST_ID, saleState: "for_sale", slug: "ada-rowe-tidal-margin-iv" };

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
  const offer = vi.fn(async () => ({
    artworkId: ARTWORK_ID,
    slug: "ada-rowe-tidal-margin-iv",
    created: true,
  }));
  deps.admin.offerOnLaxArt = { assess: vi.fn(async () => assessment as never), offer };
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();
  return { app, offer };
}

const headers = (key?: string) => ({
  authorization: `Bearer ${ADMIN_TOKEN}`,
  ...(key ? { "idempotency-key": key } : {}),
});
const url = `/admin/v1/artwork-register/${REGISTER_ID}/lax-art-offer`;

describe("Offer on lax.art capabilities", () => {
  for (const role of ALL_ROLES) {
    const canCheck = CAN_CHECK.includes(role);
    it(`${canCheck ? "lets" : "stops"} ${role} check a record`, async () => {
      const { app } = await buildApp(role);
      const response = await app.inject({ method: "GET", url, headers: headers() });
      expect(response.statusCode).toBe(canCheck ? 200 : 403);
      await app.close();
    });

    const canOffer = CAN_OFFER.includes(role);
    it(`${canOffer ? "lets" : "stops"} ${role} make the draft`, async () => {
      const { app, offer } = await buildApp(role);
      const response = await app.inject({
        method: "POST",
        url,
        headers: headers("offer-key-0001"),
        payload: offerBody,
      });
      expect(response.statusCode).toBe(canOffer ? 200 : 403);
      expect(offer).toHaveBeenCalledTimes(canOffer ? 1 : 0);
      await app.close();
    });
  }
});

describe("Offer on lax.art routes", () => {
  it("answers the check with what the dialog shows", async () => {
    const { app } = await buildApp("catalogue_editor");
    const response = await app.inject({ method: "GET", url, headers: headers() });
    expect(response.json()).toMatchObject({
      eligible: true,
      missing: ["image", "size"],
      zohoPrice: "4800.00",
    });
    await app.close();
  });

  it("hands the staff member, the key and the choices to the use case", async () => {
    const { app, offer } = await buildApp("catalogue_editor");
    const response = await app.inject({
      method: "POST",
      url,
      headers: headers("offer-key-0007"),
      payload: offerBody,
    });
    expect(response.json()).toEqual({
      artworkId: ARTWORK_ID,
      slug: "ada-rowe-tidal-margin-iv",
      created: true,
    });
    expect(offer).toHaveBeenCalledWith({
      registerId: REGISTER_ID,
      body: offerBody,
      actorSubjectId: "catalogue_editor-subject",
      idempotencyKey: "offer-key-0007",
    });
    await app.close();
  });

  it("needs an idempotency key to make the draft", async () => {
    const { app, offer } = await buildApp("catalogue_editor");
    const response = await app.inject({
      method: "POST",
      url,
      headers: headers(),
      payload: offerBody,
    });
    expect(response.statusCode).toBe(400);
    expect(offer).not.toHaveBeenCalled();
    await app.close();
  });

  it.each([
    ["how it is sold", { ...offerBody, saleState: "sold" }],
    ["the web address", { ...offerBody, slug: "Not A Slug" }],
    ["the artist", { ...offerBody, artistId: "nobody" }],
  ])("refuses a body with a bad %s", async (_name, payload) => {
    const { app, offer } = await buildApp("catalogue_editor");
    const response = await app.inject({
      method: "POST",
      url,
      headers: headers("offer-key-0002"),
      payload,
    });
    expect(response.statusCode).toBe(400);
    expect(offer).not.toHaveBeenCalled();
    await app.close();
  });
});
