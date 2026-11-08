import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";
import { createInMemoryPrintPartyStore } from "../../../test-support/in-memory-print-parties.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";

async function setup() {
  const roles = new Map<string, ShopStaffRole>();
  const deps = createMinimalShopApiTestDeps({
    env: { ...createMinimalShopApiTestDeps().env, SHOP_ADMIN_ENABLED: true },
    staffReader: {
      findActiveByIdentitySubject: async (subject: string) => {
        const role = roles.get(subject);
        return role ? { roles: [role], identitySubjectId: subject } : null;
      },
      brokerCanAccessClientParty: async () => false,
    },
  });
  deps.admin.printParties = createInMemoryPrintPartyStore(["Kestrel Editions"]);
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();
  const as = (subject: string, role: ShopStaffRole) => {
    roles.set(subject, role);
    return (method: "GET" | "POST" | "DELETE", url = "", payload?: Record<string, unknown>) => {
      vi.mocked(verifyBearerToken).mockResolvedValue({
        subject,
        payload: {
          scope: "shop.admin",
          acr: OIDC_ACR_SILVER,
          auth_time: Math.floor(Date.now() / 1000),
        },
      } as never);
      return app.inject({
        method,
        url: `/admin/v1/print-parties${url}`,
        headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
        ...(payload ? { payload } : {}),
      });
    };
  };
  return { app, as };
}

describe("the printers and publishers list", () => {
  it("is read by anyone who edits the catalogue, and changed only by a shop admin", async () => {
    const { app, as } = await setup();
    const editor = as("editor", "catalogue_editor");
    const admin = as("admin", "shop_admin");

    expect((await editor("GET")).json()).toEqual({
      items: [{ id: expect.any(String), name: "Kestrel Editions" }],
    });
    expect((await editor("POST", "", { name: "Coriander Studio, London" })).statusCode).toBe(403);

    const added = await admin("POST", "", { name: "  Coriander Studio, London  " });
    expect(added.statusCode).toBe(201);
    expect(added.json()).toMatchObject({ name: "Coriander Studio, London" });
    expect(
      ((await editor("GET")).json() as { items: { name: string }[] }).items.map((i) => i.name),
    ).toEqual(["Coriander Studio, London", "Kestrel Editions"]);

    const id = (added.json() as { id: string }).id;
    expect((await editor("DELETE", `/${id}`)).statusCode).toBe(403);
    expect((await admin("DELETE", `/${id}`)).statusCode).toBe(204);
    expect((await admin("DELETE", `/${id}`)).statusCode).toBe(404);
    await app.close();
  });

  it("lists a name once, ignoring case, and refuses a blank one", async () => {
    const { app, as } = await setup();
    const admin = as("admin", "shop_admin");
    const again = await admin("POST", "", { name: "KESTREL editions" });
    expect(again.statusCode).toBe(409);
    expect((await admin("POST", "", { name: "   " })).statusCode).toBe(400);
    expect((await admin("POST", "", { name: "x".repeat(81) })).statusCode).toBe(400);
    await app.close();
  });
});
