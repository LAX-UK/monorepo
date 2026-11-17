import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { SHOP_API_ERROR_CODES, isStepUpPath } from "@auction/shop-contracts";
import { SHOP_STAFF_ROLES, type ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { FieldValidationError } from "../../../errors/field-validation-error.js";
import { StaleVersionError } from "../../../errors/stale-version-error.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const TOKEN = "admin-token-placeholder-minimum-length";
const REGISTER_ID = "44444444-4444-4444-8444-444444444444";
const PARTY_ID = "22222222-2222-4222-8222-222222222222";
const CHANGE_ID = "66666666-6666-4666-8666-666666666666";
const KEY = "consignor-key-0001";

/** The From Zoho record is read by these roles; of them, these also read and set consignors. */
const CAN_READ: ShopStaffRole[] = ["shop_admin", "catalogue_editor"];
const CAN_MANAGE: ShopStaffRole[] = ["shop_admin", "catalogue_editor"];

const change = {
  id: CHANGE_ID,
  consignor: { kind: "client", partyId: PARTY_ID, displayName: "Ivo Marren" },
  changeReason: null,
  setAt: "2026-11-17T09:00:00.000Z",
  setByName: "Sam Staff",
};
const consignor = {
  registerId: REGISTER_ID,
  current: change,
  history: [change],
  moreHistory: false,
  agreements: [],
};

const nowSeconds = () => Math.floor(Date.now() / 1000);

async function buildApp(role: ShopStaffRole, options: { authTime?: number } = {}) {
  vi.mocked(verifyBearerToken).mockResolvedValue({
    subject: `${role}-subject`,
    payload: {
      scope: "shop.admin",
      acr: OIDC_ACR_SILVER,
      auth_time: options.authTime ?? nowSeconds(),
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
  const artworkConsignors = {
    get: vi.fn(async (): Promise<typeof consignor | null> => consignor),
    set: vi.fn(async () => consignor),
  };
  deps.admin.artworkConsignors = artworkConsignors as never;
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();
  return { app, artworkConsignors };
}

const headers = { authorization: `Bearer ${TOKEN}`, "idempotency-key": KEY };
const url = `/admin/v1/artwork-register/${REGISTER_ID}/consignor`;
const body = { consignor: { kind: "client", partyId: PARTY_ID }, expectedCurrentId: null };

describe("artwork consignor capabilities", () => {
  for (const role of SHOP_STAFF_ROLES) {
    const reads = CAN_READ.includes(role);
    it(`${reads ? "lets" : "stops"} ${role} read the consignor`, async () => {
      const { app, artworkConsignors } = await buildApp(role);
      const response = await app.inject({ method: "GET", url, headers });
      expect(response.statusCode).toBe(reads ? 200 : 403);
      expect(artworkConsignors.get).toHaveBeenCalledTimes(reads ? 1 : 0);
      await app.close();
    });

    const manages = CAN_MANAGE.includes(role);
    it(`${manages ? "lets" : "stops"} ${role} set the consignor`, async () => {
      const { app, artworkConsignors } = await buildApp(role);
      const response = await app.inject({ method: "PUT", url, headers, payload: body });
      expect(response.statusCode).toBe(manages ? 200 : 403);
      expect(artworkConsignors.set).toHaveBeenCalledTimes(manages ? 1 : 0);
      await app.close();
    });
  }
});

describe("artwork consignor routes", () => {
  it("answers 404 for an artwork that is not on the register", async () => {
    const { app, artworkConsignors } = await buildApp("shop_admin");
    artworkConsignors.get.mockResolvedValueOnce(null);
    const response = await app.inject({ method: "GET", url, headers });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("sets the consignor under the signed-in staff member with the idempotency key", async () => {
    const { app, artworkConsignors } = await buildApp("catalogue_editor");
    const response = await app.inject({
      method: "PUT",
      url,
      headers,
      payload: {
        consignor: { kind: "lax" },
        reason: "Bought outright",
        expectedCurrentId: CHANGE_ID,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(artworkConsignors.set).toHaveBeenCalledWith({
      actorSubjectId: "catalogue_editor-subject",
      idempotencyKey: KEY,
      registerId: REGISTER_ID,
      consignor: { kind: "lax" },
      reason: "Bought outright",
      expectedCurrentId: CHANGE_ID,
    });
    await app.close();
  });

  it("needs a recent sign-in to set the consignor, and lists the path for the BFF", async () => {
    expect(isStepUpPath(url)).toBe(true);
    const { app, artworkConsignors } = await buildApp("shop_admin", {
      authTime: nowSeconds() - 3600,
    });
    const response = await app.inject({ method: "PUT", url, headers, payload: body });
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe(SHOP_API_ERROR_CODES.STEP_UP_REQUIRED);
    expect(artworkConsignors.set).not.toHaveBeenCalled();
    await app.close();
  });

  it("needs an idempotency key", async () => {
    const { app } = await buildApp("shop_admin");
    const response = await app.inject({
      method: "PUT",
      url,
      headers: { authorization: headers.authorization },
      payload: body,
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("refuses a malformed body before the service", async () => {
    const { app, artworkConsignors } = await buildApp("shop_admin");
    for (const payload of [
      { consignor: { kind: "client" } },
      { consignor: { kind: "someone" } },
      { consignor: { kind: "lax" }, expectedCurrentId: "not-an-id" },
    ]) {
      const response = await app.inject({ method: "PUT", url, headers, payload });
      expect(response.statusCode).toBe(400);
    }
    expect(artworkConsignors.set).not.toHaveBeenCalled();
    await app.close();
  });

  it("passes the field the service names in a 400, and a stale change as 409", async () => {
    const { app, artworkConsignors } = await buildApp("shop_admin");
    artworkConsignors.set.mockRejectedValueOnce(
      new FieldValidationError([
        { field: "reason", message: "Say why the consignor is changing." },
      ]),
    );
    const refused = await app.inject({ method: "PUT", url, headers, payload: body });
    expect(refused.statusCode).toBe(400);
    expect(refused.json().issues).toEqual([
      { field: "reason", message: "Say why the consignor is changing." },
    ]);
    artworkConsignors.set.mockRejectedValueOnce(new StaleVersionError("The consignor", CHANGE_ID));
    const stale = await app.inject({ method: "PUT", url, headers, payload: body });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().currentVersion).toBe(CHANGE_ID);
    await app.close();
  });
});
