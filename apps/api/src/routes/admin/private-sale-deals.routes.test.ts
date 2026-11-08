import type { StaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { attachAdminPrivateSaleDealRoutes } from "./private-sale-deals.routes.js";

const RECORD = { reference: "PS-0012", stage: "offer", version: 3 };

function createApp(staffRoles: StaffRoles | undefined) {
  const privateSaleDeals = {
    list: vi.fn().mockResolvedValue({ items: [], nextCursor: null, counts: {} }),
    detail: vi.fn().mockResolvedValue(RECORD),
    updateTerms: vi.fn().mockResolvedValue({ ok: true, record: RECORD }),
    nameBuyer: vi.fn().mockResolvedValue({ ok: true, record: RECORD }),
    act: vi.fn().mockResolvedValue({ ok: true, record: RECORD }),
  };
  const stepUp = vi.fn(async (_c: unknown, next: () => Promise<void>) => next());
  const idempotentScopes: string[] = [];
  const app = new Hono<{
    Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
  }>();
  app.use("*", async (c, next) => {
    c.set("userId", "staff-1");
    c.set("userRole", "staff");
    c.set("userStaffRoles", staffRoles);
    await next();
  });
  attachAdminPrivateSaleDealRoutes(
    app as never,
    { admin: { privateSaleDeals } } as never,
    {
      requireStepUp: stepUp as never,
      idempotent: (scope: string) => {
        idempotentScopes.push(scope);
        return async (_c: unknown, next: () => Promise<void>) => next();
      },
    } as never,
  );
  return { app, privateSaleDeals, stepUp, idempotentScopes };
}

const send = (method: string, body: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

describe("who may open the deals", () => {
  it.each([
    "administrator",
    "sales_manager",
    "specialist",
    "client_services",
    "finance",
    "fulfilment",
    "compliance",
  ] as const)("%s reads them", async (role) => {
    const { app } = createApp([role]);
    expect((await app.request("http://test/private-sales")).status).toBe(200);
  });

  it.each(["cataloguer", "saleroom_clerk", "read_only"] as const)("%s does not", async (role) => {
    const { app, privateSaleDeals } = createApp([role]);
    expect((await app.request("http://test/private-sales")).status).toBe(403);
    expect((await app.request("http://test/private-sales/PS-0012")).status).toBe(403);
    expect(privateSaleDeals.list).not.toHaveBeenCalled();
    expect(privateSaleDeals.detail).not.toHaveBeenCalled();
  });
});

describe("what the desk is told about the person", () => {
  const ALL = { kind: "all" } as const;
  it.each([
    ["sales_manager", { manage: true, finance: false, release: false }, true, ALL],
    [
      "specialist",
      { manage: true, finance: false, release: false },
      true,
      { kind: "owned", userId: "staff-1" },
    ],
    ["finance", { manage: false, finance: true, release: false }, false, ALL],
    [
      "fulfilment",
      { manage: false, finance: false, release: true },
      false,
      { kind: "stages", stages: ["paid"] },
    ],
    ["client_services", { manage: false, finance: false, release: false }, false, ALL],
    ["compliance", { manage: false, finance: false, release: false }, true, ALL],
    ["administrator", { manage: true, finance: true, release: true }, true, ALL],
  ] as const)("%s", async (role, abilities, checks, scope) => {
    const { app, privateSaleDeals } = createApp([role]);
    await app.request("http://test/private-sales/PS-0012");
    expect(privateSaleDeals.detail).toHaveBeenCalledWith(
      { userId: "staff-1", abilities, checks, scope },
      "PS-0012",
    );
  });
});

describe("GET /private-sales", () => {
  it("lists a view and passes the cursor on", async () => {
    const { app, privateSaleDeals } = createApp(["sales_manager"]);
    const res = await app.request("http://test/private-sales?view=payment_due&limit=10&cursor=abc");
    expect(res.status).toBe(200);
    expect(privateSaleDeals.list).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "staff-1" }),
      { view: "payment_due", limit: 10, cursor: "abc" },
    );
  });

  it("opens on the active view", async () => {
    const { app, privateSaleDeals } = createApp(["sales_manager"]);
    await app.request("http://test/private-sales");
    expect(privateSaleDeals.list).toHaveBeenCalledWith(expect.anything(), {
      view: "active",
      limit: 25,
    });
  });

  it("rejects a view that does not exist", async () => {
    const { app, privateSaleDeals } = createApp(["sales_manager"]);
    expect((await app.request("http://test/private-sales?view=mine")).status).toBe(400);
    expect(privateSaleDeals.list).not.toHaveBeenCalled();
  });
});

describe("GET /private-sales/:ref", () => {
  it("answers 404 for a deal that does not exist, and 400 for a reference that is not one", async () => {
    const { app, privateSaleDeals } = createApp(["sales_manager"]);
    privateSaleDeals.detail.mockResolvedValueOnce(null);
    expect((await app.request("http://test/private-sales/PS-9999")).status).toBe(404);
    expect((await app.request("http://test/private-sales/not-a-deal")).status).toBe(400);
  });

  it("accepts the reference in lower case", async () => {
    const { app, privateSaleDeals } = createApp(["sales_manager"]);
    await app.request("http://test/private-sales/ps-0012");
    expect(privateSaleDeals.detail).toHaveBeenCalledWith(expect.anything(), "PS-0012");
  });
});

describe("PATCH /private-sales/:ref", () => {
  it("changes terms against a version", async () => {
    const { app, privateSaleDeals } = createApp(["sales_manager"]);
    const res = await app.request(
      "http://test/private-sales/PS-0012",
      send("PATCH", { version: 3, terms: { priceMinor: 4_800_000 } }),
    );
    expect(res.status).toBe(200);
    expect(privateSaleDeals.updateTerms).toHaveBeenCalledWith(expect.anything(), "PS-0012", {
      version: 3,
      terms: { priceMinor: 4_800_000 },
    });
  });

  it.each([
    [{ version: 3, terms: {} }],
    [{ terms: { priceMinor: 1 } }],
    [{ version: 3, terms: { priceMinor: -5 } }],
    [{ version: 3, terms: { somethingElse: 1 } }],
    [{ version: 3, terms: { vatTreatment: "Margin Scheme" } }],
  ])("rejects %j", async (body) => {
    const { app, privateSaleDeals } = createApp(["sales_manager"]);
    const res = await app.request("http://test/private-sales/PS-0012", send("PATCH", body));
    expect(res.status).toBe(400);
    expect(privateSaleDeals.updateTerms).not.toHaveBeenCalled();
  });

  it.each([
    ["forbidden", 403],
    ["stale_version", 409],
    ["term_locked", 409],
    ["vat_treatment_not_allowed", 422],
    ["deal_not_found", 404],
  ] as const)("answers %s with %i and what was refused", async (error, status) => {
    const { app, privateSaleDeals } = createApp(["sales_manager"]);
    privateSaleDeals.updateTerms.mockResolvedValueOnce({
      ok: false,
      error,
      fields: ["priceMinor"],
      currentVersion: 5,
    });
    const res = await app.request(
      "http://test/private-sales/PS-0012",
      send("PATCH", { version: 3, terms: { priceMinor: 1 } }),
    );
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error, fields: ["priceMinor"], currentVersion: 5 });
  });
});

describe("PUT /private-sales/:ref/buyer", () => {
  it("names the person acting for the buyer", async () => {
    const { app, privateSaleDeals } = createApp(["sales_manager"]);
    const res = await app.request(
      "http://test/private-sales/PS-0012/buyer",
      send("PUT", { version: 3, buyerUserId: "u-1" }),
    );
    expect(res.status).toBe(200);
    expect(privateSaleDeals.nameBuyer).toHaveBeenCalledWith(expect.anything(), "PS-0012", {
      version: 3,
      buyerUserId: "u-1",
    });
  });

  it("rejects an organisation id that is not an id", async () => {
    const { app, privateSaleDeals } = createApp(["sales_manager"]);
    const res = await app.request(
      "http://test/private-sales/PS-0012/buyer",
      send("PUT", { version: 3, buyerUserId: "u-1", legalEntityId: "nope" }),
    );
    expect(res.status).toBe(400);
    expect(privateSaleDeals.nameBuyer).not.toHaveBeenCalled();
  });
});

describe("POST /private-sales/:ref/actions/:action", () => {
  it("makes a move with its reason", async () => {
    const { app, privateSaleDeals } = createApp(["sales_manager"]);
    const res = await app.request(
      "http://test/private-sales/PS-0012/actions/cancel",
      send("POST", { version: 4, reason: "Seller withdrew" }),
    );
    expect(res.status).toBe(200);
    expect(privateSaleDeals.act).toHaveBeenCalledWith(expect.anything(), "PS-0012", "cancel", {
      version: 4,
      reason: "Seller withdrew",
    });
  });

  it("needs the version the person was looking at", async () => {
    const { app, privateSaleDeals } = createApp(["administrator"]);
    const res = await app.request(
      "http://test/private-sales/PS-0012/actions/agree",
      send("POST", {}),
    );
    expect(res.status).toBe(400);
    expect(privateSaleDeals.act).not.toHaveBeenCalled();
  });

  it("answers a stale version with the current one", async () => {
    const { app, privateSaleDeals } = createApp(["administrator"]);
    privateSaleDeals.act.mockResolvedValueOnce({
      ok: false,
      error: "stale_version",
      currentVersion: 6,
    });
    const res = await app.request(
      "http://test/private-sales/PS-0012/actions/agree",
      send("POST", { version: 4 }),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "stale_version", currentVersion: 6 });
  });

  it("does not know a move that is not on the list", async () => {
    const { app, privateSaleDeals } = createApp(["sales_manager"]);
    for (const action of ["mark_paid", "settle", "delete"]) {
      const res = await app.request(
        `http://test/private-sales/PS-0012/actions/${action}`,
        send("POST", { version: 4 }),
      );
      expect(res.status).toBe(400);
    }
    expect(privateSaleDeals.act).not.toHaveBeenCalled();
  });

  it("explains every reason a move is blocked", async () => {
    const { app, privateSaleDeals } = createApp(["administrator"]);
    const blockers = [
      {
        code: "kyc_not_clear",
        message: "The buyer has not verified their identity yet.",
        party: "buyer",
      },
    ];
    privateSaleDeals.act.mockResolvedValueOnce({ ok: false, error: "blocked", blockers });
    const res = await app.request(
      "http://test/private-sales/PS-0012/actions/agree",
      send("POST", { version: 4 }),
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "blocked", blockers });
  });

  it.each(["issue_invoice", "refund"] as const)(
    "asks for a recent sign-in and an idempotency key before %s",
    async (action) => {
      const { app, stepUp, idempotentScopes, privateSaleDeals } = createApp(["administrator"]);
      await app.request(
        `http://test/private-sales/PS-0012/actions/${action}`,
        send("POST", { version: 4 }),
      );
      expect(stepUp).toHaveBeenCalledTimes(1);
      expect(idempotentScopes).toContain(`private-sales.${action}`);
      expect(privateSaleDeals.act).toHaveBeenCalledTimes(1);
    },
  );

  it("guards every move that holds the finance ability, whatever it is called", async () => {
    const { ACTION_ABILITY } = await import(
      "../../services/private-sale-deal/deal-staff-permissions.js"
    );
    const money = Object.entries(ACTION_ABILITY)
      .filter(([, ability]) => ability === "finance")
      .map(([action]) => action);
    expect(money.sort()).toEqual([
      "issue_invoice",
      "record_bank_refund",
      "record_bank_transfer",
      "refund",
    ]);
    for (const action of money) {
      const { app, stepUp } = createApp(["administrator"]);
      await app.request(
        `http://test/private-sales/PS-0012/actions/${action}`,
        send("POST", { version: 4 }),
      );
      expect(stepUp).toHaveBeenCalledTimes(1);
    }
  });

  it("does not ask for a recent sign-in for a move that moves no money", async () => {
    const { app, stepUp } = createApp(["administrator"]);
    await app.request(
      "http://test/private-sales/PS-0012/actions/agree",
      send("POST", { version: 4 }),
    );
    expect(stepUp).not.toHaveBeenCalled();
  });

  it("does not make a money move when the recent sign-in check refuses", async () => {
    const { app, stepUp, privateSaleDeals } = createApp(["administrator"]);
    stepUp.mockImplementationOnce(
      async (c: unknown) =>
        (c as { json: (b: unknown, s: number) => Response }).json(
          { error: "step_up_required" },
          403,
        ) as never,
    );
    const res = await app.request(
      "http://test/private-sales/PS-0012/actions/issue_invoice",
      send("POST", { version: 4 }),
    );
    expect(res.status).toBe(403);
    expect(privateSaleDeals.act).not.toHaveBeenCalled();
  });
});
