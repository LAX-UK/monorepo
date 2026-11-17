import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import {
  type AdminReleaseAlertSend,
  AdminReleaseAlertSendListSchema,
  AdminReleaseAlertSendSchema,
} from "@auction/shop-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import type { ReleaseAlertSendLogReader } from "../../../application/alerts/alert-ports.js";
import { InvalidCatalogueCursorError } from "../../../application/catalogue-cursor.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";
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
/** `lead.read`, the same people who read the Leads page. */
const CAN_READ: ShopStaffRole[] = ["shop_admin", "account_manager"];
const URL = "/admin/v1/release-alerts/sends";
const auth = { authorization: `Bearer ${ADMIN_TOKEN}` };

const SENT: AdminReleaseAlertSend = {
  artworkId: "11111111-1111-4111-8111-111111111111",
  title: "Harbour at dusk, edition of 50",
  imageUrl: null,
  publishedAt: "2026-11-14T10:30:00.000Z",
  publishedByName: "Sam Example",
  toldSubscribers: true,
  status: "sent",
  countsKept: true,
  matched: 412,
  emailed: 398,
  waiting: 0,
  notSent: 14,
  notSentReasons: [{ reason: "topic_off", count: 14 }],
};

async function buildApp(role: ShopStaffRole, sends?: Partial<ReleaseAlertSendLogReader>) {
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
  if (sends) deps.admin.releaseAlertSends = { ...deps.admin.releaseAlertSends, ...sends };
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();
  return app;
}

describe("GET /admin/v1/release-alerts/sends capabilities", () => {
  for (const role of ALL_ROLES) {
    const allowed = CAN_READ.includes(role);
    it(`${role} ${allowed ? "can" : "cannot"} read the send log`, async () => {
      const app = await buildApp(role);
      const response = await app.inject({ method: "GET", url: URL, headers: auth });
      expect(response.statusCode).toBe(allowed ? 200 : 403);
      await app.close();
    });
  }

  it("needs a signed-in staff member", async () => {
    const app = await buildApp("shop_admin");
    const response = await app.inject({ method: "GET", url: URL });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe("GET /admin/v1/release-alerts/sends", () => {
  it("answers a page of releases in the contract shape and passes the cursor through", async () => {
    const list = vi.fn(async () => ({ items: [SENT], nextCursor: "next-page" }));
    const app = await buildApp("account_manager", { list });
    const response = await app.inject({
      method: "GET",
      url: `${URL}?cursor=abc&limit=10`,
      headers: auth,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Value.Check(AdminReleaseAlertSendListSchema, body)).toBe(true);
    expect(body).toEqual({ items: [SENT], nextCursor: "next-page" });
    expect(list).toHaveBeenCalledWith({ cursor: "abc", limit: 10 });
    await app.close();
  });

  it("never lets a subscriber's name or address out, even if a reader returned one", async () => {
    const leaky = { ...SENT, subscriberEmails: ["someone@example.com"] };
    const app = await buildApp("shop_admin", {
      list: async () => ({ items: [leaky as AdminReleaseAlertSend], nextCursor: null }),
    });
    const response = await app.inject({ method: "GET", url: URL, headers: auth });
    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("someone@example.com");
    await app.close();
  });

  it("refuses a page size beyond the bound", async () => {
    const app = await buildApp("shop_admin");
    const response = await app.inject({ method: "GET", url: `${URL}?limit=51`, headers: auth });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("answers a cursor it cannot read with 400", async () => {
    const app = await buildApp("shop_admin", {
      list: async () => {
        throw new InvalidCatalogueCursorError();
      },
    });
    const response = await app.inject({ method: "GET", url: `${URL}?cursor=junk`, headers: auth });
    expect(response.statusCode).toBe(400);
    await app.close();
  });
});

describe("GET /admin/v1/release-alerts/sends/:artworkId", () => {
  const ONE = `${URL}/${SENT.artworkId}`;

  for (const role of ALL_ROLES) {
    const allowed = CAN_READ.includes(role);
    it(`${role} ${allowed ? "can" : "cannot"} read one release`, async () => {
      const app = await buildApp(role, { find: async () => SENT });
      const response = await app.inject({ method: "GET", url: ONE, headers: auth });
      expect(response.statusCode).toBe(allowed ? 200 : 403);
      await app.close();
    });
  }

  it("answers one release in the contract shape, read by its work", async () => {
    const find = vi.fn(async () => SENT);
    const app = await buildApp("account_manager", { find });
    const response = await app.inject({ method: "GET", url: ONE, headers: auth });
    expect(response.statusCode).toBe(200);
    expect(Value.Check(AdminReleaseAlertSendSchema, response.json())).toBe(true);
    expect(response.json()).toEqual(SENT);
    expect(find).toHaveBeenCalledWith(SENT.artworkId);
    await app.close();
  });

  it("answers 404 for a work with no release in the log", async () => {
    const app = await buildApp("shop_admin", { find: async () => null });
    const response = await app.inject({ method: "GET", url: ONE, headers: auth });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: "not_found" });
    await app.close();
  });

  it("refuses an id that is not a work id with 400, without reading", async () => {
    const find = vi.fn(async () => SENT);
    const app = await buildApp("shop_admin", { find });
    const response = await app.inject({ method: "GET", url: `${URL}/not-a-uuid`, headers: auth });
    expect(response.statusCode).toBe(400);
    expect(find).not.toHaveBeenCalled();
    await app.close();
  });
});
