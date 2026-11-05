import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { ShopApiError } from "../../../errors/shop-api-error.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";
const ARTWORK_ID = "77777777-7777-4777-8777-777777777777";
const REGISTER_ID = "44444444-4444-4444-8444-444444444444";

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
const CAN_SEE: ShopStaffRole[] = ["shop_admin", "catalogue_editor", "read_only"];
const CAN_LINK: ShopStaffRole[] = ["shop_admin", "catalogue_editor"];
const CAN_UNLINK: ShopStaffRole[] = ["shop_admin"];

const outcome = {
  artworkId: ARTWORK_ID,
  registerId: REGISTER_ID,
  status: "linked",
  message: null,
  nowOnLaxArt: true,
  replaced: [],
};
const linkBody = { artworkId: ARTWORK_ID, registerId: REGISTER_ID };

async function buildApp(role: ShopStaffRole, overrides: Record<string, unknown> = {}) {
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
  const zohoLink = {
    count: vi.fn(async () => ({ unlinked: 3 })),
    report: vi.fn(async () => ({
      checkedAt: "2026-11-05T09:00:00.000Z",
      counts: { unlinked: 0, matched: 0, needsChoice: 0, noMatch: 0 },
      matched: [],
      needsChoice: [],
      noMatch: [],
      blockUnlinkedPublish: false,
    })),
    preview: vi.fn(),
    search: vi.fn(async () => ({ items: [], more: false })),
    link: vi.fn(async () => outcome),
    linkBulk: vi.fn(async () => ({ outcomes: [outcome] })),
    unlink: vi.fn(async () => ({ artworkId: ARTWORK_ID, unlinked: true })),
    settings: vi.fn(async () => ({ blockUnlinkedPublish: false })),
    updateSettings: vi.fn(async () => ({ blockUnlinkedPublish: true })),
    ...overrides,
  };
  deps.admin.zohoLink = zohoLink as never;
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();
  return { app, zohoLink };
}

const headers = { authorization: `Bearer ${ADMIN_TOKEN}` };
const base = "/admin/v1/artwork-register/zoho-link";

describe("Link lax.art capabilities", () => {
  for (const role of ALL_ROLES) {
    const sees = CAN_SEE.includes(role);
    it(`${sees ? "lets" : "stops"} ${role} see the report and search`, async () => {
      const { app } = await buildApp(role);
      for (const path of ["/count", "/report", "/search?q=tidal", "/settings"]) {
        const response = await app.inject({ method: "GET", url: `${base}${path}`, headers });
        expect(response.statusCode, path).toBe(sees ? 200 : 403);
      }
      await app.close();
    });

    const links = CAN_LINK.includes(role);
    it(`${links ? "lets" : "stops"} ${role} link, one or in bulk`, async () => {
      const { app, zohoLink } = await buildApp(role);
      const one = await app.inject({
        method: "POST",
        url: `${base}/link`,
        headers,
        payload: linkBody,
      });
      const bulk = await app.inject({
        method: "POST",
        url: `${base}/link-bulk`,
        headers,
        payload: { links: [linkBody] },
      });
      expect(one.statusCode).toBe(links ? 200 : 403);
      expect(bulk.statusCode).toBe(links ? 200 : 403);
      expect(zohoLink.link).toHaveBeenCalledTimes(links ? 1 : 0);
      expect(zohoLink.linkBulk).toHaveBeenCalledTimes(links ? 1 : 0);
      await app.close();
    });

    const unlinks = CAN_UNLINK.includes(role);
    it(`${unlinks ? "lets" : "stops"} ${role} remove a link and change the switch`, async () => {
      const { app, zohoLink } = await buildApp(role);
      const unlink = await app.inject({
        method: "POST",
        url: `${base}/unlink`,
        headers,
        payload: { artworkId: ARTWORK_ID, reason: "Wrong record" },
      });
      const setting = await app.inject({
        method: "PUT",
        url: `${base}/settings`,
        headers,
        payload: { blockUnlinkedPublish: true },
      });
      expect(unlink.statusCode).toBe(unlinks ? 200 : 403);
      expect(setting.statusCode).toBe(unlinks ? 200 : 403);
      expect(zohoLink.unlink).toHaveBeenCalledTimes(unlinks ? 1 : 0);
      await app.close();
    });
  }
});

describe("Link lax.art routes", () => {
  it("hands the staff member to the use case", async () => {
    const { app, zohoLink } = await buildApp("catalogue_editor");
    await app.inject({ method: "POST", url: `${base}/link`, headers, payload: linkBody });
    expect(zohoLink.link).toHaveBeenCalledWith(linkBody, "catalogue_editor-subject");
    await app.close();
  });

  it("answers a refused link with 409 and the register's words", async () => {
    const message = "This artwork is in a LAX Bid sale. Withdraw the lot there first.";
    const { app } = await buildApp("catalogue_editor", {
      link: vi.fn(async () => ({ ...outcome, status: "refused", message, nowOnLaxArt: false })),
    });
    const response = await app.inject({
      method: "POST",
      url: `${base}/link`,
      headers,
      payload: linkBody,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ message });
    await app.close();
  });

  it("answers an unlink the use case refuses with 409", async () => {
    const { app } = await buildApp("shop_admin", {
      unlink: vi.fn(async () => {
        throw new ShopApiError("shop.conflict", "This artwork is in a LAX Bid sale.", 409);
      }),
    });
    const response = await app.inject({
      method: "POST",
      url: `${base}/unlink`,
      headers,
      payload: { artworkId: ARTWORK_ID, reason: "Wrong record" },
    });
    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it.each([
    ["an empty reason", { artworkId: ARTWORK_ID, reason: "" }],
    ["no reason", { artworkId: ARTWORK_ID }],
    ["a bad artwork", { artworkId: "nope", reason: "x" }],
  ])("refuses an unlink with %s", async (_name, payload) => {
    const { app, zohoLink } = await buildApp("shop_admin");
    const response = await app.inject({ method: "POST", url: `${base}/unlink`, headers, payload });
    expect(response.statusCode).toBe(400);
    expect(zohoLink.unlink).not.toHaveBeenCalled();
    await app.close();
  });

  it.each([
    ["an empty list", { links: [] }],
    ["a bad id", { links: [{ artworkId: "x", registerId: REGISTER_ID }] }],
  ])("refuses a bulk link with %s", async (_name, payload) => {
    const { app, zohoLink } = await buildApp("catalogue_editor");
    const response = await app.inject({
      method: "POST",
      url: `${base}/link-bulk`,
      headers,
      payload,
    });
    expect(response.statusCode).toBe(400);
    expect(zohoLink.linkBulk).not.toHaveBeenCalled();
    await app.close();
  });

  it("refuses a search shorter than two characters", async () => {
    const { app } = await buildApp("catalogue_editor");
    const response = await app.inject({ method: "GET", url: `${base}/search?q=t`, headers });
    expect(response.statusCode).toBe(400);
    await app.close();
  });
});
