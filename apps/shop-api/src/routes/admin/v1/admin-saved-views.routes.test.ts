import { verifyBearerToken } from "@auction/auth/token-verifier";
import { OIDC_ACR_SILVER } from "@auction/identity-contracts";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(),
}));

import { createShopApiApp } from "../../../app.js";
import { createSavedViewService } from "../../../application/saved-view.service.js";
import { createMinimalShopApiTestDeps } from "../../../test-app-deps.js";
import { createInMemorySavedViewRepository } from "../../../test-support/in-memory-saved-view-repository.js";

const ADMIN_TOKEN = "admin-token-placeholder-minimum-length";

const ALL_ROLES: ShopStaffRole[] = [
  "shop_admin",
  "account_manager",
  "broker",
  "operations",
  "finance",
  "catalogue_editor",
];
const CAN_USE_ORDERS: ShopStaffRole[] = ["shop_admin", "account_manager", "operations", "finance"];
const CAN_USE_STAFF: ShopStaffRole[] = ["shop_admin"];

type Person = { subject: string; role: ShopStaffRole };

async function setup() {
  const people = new Map<string, ShopStaffRole>();
  const repository = createInMemorySavedViewRepository();
  const deps = createMinimalShopApiTestDeps({
    env: {
      ...createMinimalShopApiTestDeps().env,
      SHOP_ADMIN_ENABLED: true,
    },
    staffReader: {
      findActiveByIdentitySubject: async (subject: string) => {
        const role = people.get(subject);
        return role ? { roles: [role], identitySubjectId: subject } : null;
      },
      brokerCanAccessClientParty: async () => false,
    },
  });
  deps.admin.savedViews = createSavedViewService({ repository });
  const app = createShopApiApp({ deps, logger: false });
  await app.ready();

  const as = (person: Person) => {
    people.set(person.subject, person.role);
    const call = async (
      method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
      url: string,
      payload?: unknown,
    ) => {
      vi.mocked(verifyBearerToken).mockResolvedValue({
        subject: person.subject,
        payload: {
          scope: "shop.admin",
          acr: OIDC_ACR_SILVER,
          auth_time: Math.floor(Date.now() / 1000),
        },
      } as never);
      return app.inject({
        method,
        url: `/admin/v1/saved-views${url}`,
        headers: { authorization: `Bearer ${ADMIN_TOKEN}` },
        ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
      });
    };
    return {
      list: (listKey: string) => call("GET", `?listKey=${encodeURIComponent(listKey)}`),
      create: (body: unknown) => call("POST", "", body),
      rename: (id: string, label: string) => call("PATCH", `/${id}`, { label }),
      reorder: (listKey: string, ids: string[]) => call("PUT", "/order", { listKey, ids }),
      remove: (id: string) => call("DELETE", `/${id}`),
    };
  };
  return { as, app, repository, close: () => app.close() };
}

const orderView = (label: string, query = "status=paid") => ({
  listKey: "lax-admin.orders",
  label,
  query,
});

const labels = (response: { json: () => { items: { label: string }[] } }) =>
  response.json().items.map((view) => view.label);

describe("saved views by role", () => {
  it.each(ALL_ROLES.map((role) => ({ role, allowed: CAN_USE_ORDERS.includes(role) })))(
    "orders views as $role are allowed: $allowed",
    async ({ role, allowed }) => {
      const { as, close } = await setup();
      const person = as({ subject: `${role}-subject`, role });

      const created = await person.create(orderView("Paid"));
      const listed = await person.list("lax-admin.orders");

      if (allowed) {
        expect(created.statusCode).toBe(201);
        expect(labels(listed)).toEqual(["Paid"]);
      } else {
        expect(created.statusCode).toBe(403);
        expect(listed.statusCode).toBe(403);
        expect(listed.json().code).toBe(SHOP_API_ERROR_CODES.FORBIDDEN);
      }
      await close();
    },
  );

  it.each(ALL_ROLES.map((role) => ({ role, allowed: CAN_USE_STAFF.includes(role) })))(
    "staff views as $role are allowed: $allowed",
    async ({ role, allowed }) => {
      const { as, close } = await setup();
      const person = as({ subject: `${role}-subject`, role });

      const listed = await person.list("lax-admin.staff");
      const reordered = await person.reorder("lax-admin.staff", []);

      expect(listed.statusCode).toBe(allowed ? 200 : 403);
      expect(reordered.statusCode).toBe(allowed ? 200 : 403);
      await close();
    },
  );

  it("refuses an unauthenticated request", async () => {
    const { app, close } = await setup();
    const response = await app.inject({
      method: "GET",
      url: "/admin/v1/saved-views?listKey=lax-admin.orders",
    });
    expect(response.statusCode).toBe(401);
    await close();
  });
});

describe("saved views by owner", () => {
  const alice: Person = { subject: "alice-subject", role: "shop_admin" };
  const bob: Person = { subject: "bob-subject", role: "shop_admin" };

  it("never shows one person's views to another", async () => {
    const { as, close } = await setup();
    await as(alice).create(orderView("Alice only"));

    expect(labels(await as(bob).list("lax-admin.orders"))).toEqual([]);
    await close();
  });

  it("lets two people use the same view name", async () => {
    const { as, close } = await setup();
    expect((await as(alice).create(orderView("Paid"))).statusCode).toBe(201);
    expect((await as(bob).create(orderView("Paid"))).statusCode).toBe(201);
    await close();
  });

  it("answers 404 when renaming or deleting someone else's view, and leaves it unchanged", async () => {
    const { as, repository, close } = await setup();
    const view = (await as(alice).create(orderView("Alice only"))).json();

    expect((await as(bob).rename(view.id, "Stolen")).statusCode).toBe(404);
    expect((await as(bob).remove(view.id)).statusCode).toBe(404);

    expect(repository.rows.map((row) => row.label)).toEqual(["Alice only"]);
    await close();
  });

  it("does not let one person reorder using another's view ids", async () => {
    const { as, close } = await setup();
    const view = (await as(alice).create(orderView("Alice only"))).json();
    await as(bob).create(orderView("Bob only"));

    const response = await as(bob).reorder("lax-admin.orders", [view.id]);

    expect(response.statusCode).toBe(409);
    await close();
  });
});

describe("saved views rules", () => {
  const person: Person = { subject: "admin-subject", role: "shop_admin" };

  it("rejects a list that is not in the allow-list", async () => {
    const { as, close } = await setup();
    expect((await as(person).list("lax-admin.secrets")).statusCode).toBe(400);
    expect((await as(person).create({ listKey: "other", label: "x", query: "" })).statusCode).toBe(
      400,
    );
    await close();
  });

  it("rejects an empty or over-long name and an over-long query", async () => {
    const { as, close } = await setup();
    expect((await as(person).create(orderView("   "))).statusCode).toBe(400);
    expect((await as(person).create(orderView("x".repeat(41)))).statusCode).toBe(400);
    expect((await as(person).create(orderView("Long", `q=${"a".repeat(1000)}`))).statusCode).toBe(
      400,
    );
    await close();
  });

  it("trims the name and drops a leading question mark from the query", async () => {
    const { as, close } = await setup();
    await as(person).create(orderView("  Paid  ", "?status=paid"));

    const items = (await as(person).list("lax-admin.orders")).json().items;

    expect(items).toMatchObject([{ label: "Paid", query: "status=paid" }]);
    await close();
  });

  it("answers 409 with a code for a repeated name", async () => {
    const { as, close } = await setup();
    await as(person).create(orderView("Paid"));

    const response = await as(person).create(orderView("Paid", "status=refunded"));

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe(SHOP_API_ERROR_CODES.SAVED_VIEW_DUPLICATE);
    await close();
  });

  it("caps the views one person keeps for a list at 50", async () => {
    const { as, close } = await setup();
    for (let n = 0; n < 50; n += 1) {
      expect((await as(person).create(orderView(`View ${n}`))).statusCode).toBe(201);
    }

    const response = await as(person).create(orderView("One too many"));

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe(SHOP_API_ERROR_CODES.SAVED_VIEW_LIMIT);
    // The cap is per list: another list is unaffected.
    expect(
      (await as(person).create({ listKey: "lax-admin.staff", label: "Fresh", query: "" }))
        .statusCode,
    ).toBe(201);
    await close();
  });

  it("renames, reorders and deletes", async () => {
    const { as, close } = await setup();
    const a = (await as(person).create(orderView("A"))).json();
    const b = (await as(person).create(orderView("B", "status=refunded"))).json();
    const c = (await as(person).create(orderView("C", "status=pending_payment"))).json();

    expect((await as(person).rename(a.id, "Alpha")).statusCode).toBe(200);
    const reordered = await as(person).reorder("lax-admin.orders", [c.id, a.id, b.id]);
    expect(reordered.statusCode).toBe(200);
    expect(labels(reordered)).toEqual(["C", "Alpha", "B"]);

    expect((await as(person).remove(b.id)).statusCode).toBe(204);
    expect(labels(await as(person).list("lax-admin.orders"))).toEqual(["C", "Alpha"]);
    await close();
  });

  it("refuses a reorder that is not exactly the person's current views", async () => {
    const { as, close } = await setup();
    const a = (await as(person).create(orderView("A"))).json();
    await as(person).create(orderView("B", "status=refunded"));

    const response = await as(person).reorder("lax-admin.orders", [a.id]);

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe(SHOP_API_ERROR_CODES.SAVED_VIEW_ORDER_CHANGED);
    await close();
  });

  it("answers 400 for an id that is not a uuid", async () => {
    const { as, close } = await setup();
    expect((await as(person).remove("nope")).statusCode).toBe(400);
    await close();
  });
});
