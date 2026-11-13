import { ACCOUNTING_QUEUE_WRITE_ACCESS, type StaffRoles, userHasAccessTo } from "@auction/types";
import { Hono, type MiddlewareHandler } from "hono";
import { describe, expect, it, vi } from "vitest";
import { requireFinanceAccess } from "../../middleware/require-capability.js";
import type { IAccountingQueueService } from "../../services/interfaces/accounting-queue.js";
import { createTestStaffGuards } from "../../testing/staff-mutation-guards.js";
import type { AdminHono } from "./_shared.js";
import { attachAdminAccountingRoutes } from "./accounting.routes.js";

type Body = {
  data: {
    rows: Record<string, unknown>[] & { id: string; organisation: string; problem: string }[];
    total: number;
    counts: Record<string, number>;
    outcome: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};
const read = (res: Response) => res.json() as Promise<Body>;

const DOC_ID = "5b0f3a50-1f43-4f63-9f2b-5e8f3f7f1a10";
const counts = { needs_person: 1, failed: 2, waiting: 0, issued: 3 };

/**
 * The mount's `finance.read` gate. Every role holding `finance.read` today also holds the write, so
 * a test of the write guard swaps in a gate that lets the request through, as a future read-only
 * finance role would be let through, leaving the route's own guard as the only check.
 */
const passReadGate: MiddlewareHandler = async (_c, next) => {
  await next();
};

function build(
  staffRoles: StaffRoles = ["finance"],
  queue: Partial<IAccountingQueueService> = {},
  financeGate: MiddlewareHandler = requireFinanceAccess,
) {
  const service = {
    list: vi.fn(async (request) => ({
      tab: request.tab,
      organisation: request.organisation,
      rows: [],
      total: 0,
      reference: request.reference,
      counts,
      issuedToday: 0,
      lastSent: null,
      limit: request.limit,
      offset: request.offset,
      unreadable: 0,
      canAct: request.canAct,
    })),
    tryAgain: vi.fn(async () => ({
      ok: true as const,
      value: { id: DOC_ID, reference: "LAX-BID-INV-a1", outcome: "requeued" as const },
    })),
    ...queue,
  };
  const app: AdminHono = new Hono();
  app.use("*", async (c, next) => {
    c.set("userId", "staff-1");
    c.set("identitySessionId", "session-1");
    c.set("userRole", "staff");
    c.set("userStaffRoles", staffRoles);
    await next();
  });
  app.use("/finance/*", financeGate);
  attachAdminAccountingRoutes(
    app,
    { admin: { accountingQueue: service } } as never,
    createTestStaffGuards({ recent: true }),
  );
  return { app, service };
}

function tryAgain(app: AdminHono, key = "key-0001-try-again", id = DOC_ID) {
  return app.request(`/finance/accounting/${id}/try-again`, {
    method: "POST",
    headers: { "Idempotency-Key": key },
  });
}

describe("GET /finance/accounting", () => {
  it("passes the tab, company and page, and says whether the person may act", async () => {
    const { app, service } = build(["finance"]);
    const res = await app.request(
      "/finance/accounting?tab=failed&organisation=london_art_exchange&limit=20&offset=40",
    );
    expect(res.status).toBe(200);
    expect(service.list).toHaveBeenCalledWith({
      tab: "failed",
      organisation: "london_art_exchange",
      reference: null,
      limit: 20,
      offset: 40,
      canAct: true,
    });
    expect((await read(res)).data).toMatchObject({ canAct: true, counts });
  });

  it("defaults to Needs a person for both companies, 50 at a time", async () => {
    const { app, service } = build(["administrator"]);
    await app.request("/finance/accounting");
    expect(service.list).toHaveBeenCalledWith({
      tab: "needs_person",
      organisation: null,
      reference: null,
      limit: 50,
      offset: 0,
      canAct: true,
    });
  });

  it("passes a validated LAX reference through to the service", async () => {
    const { app, service } = build(["finance"]);
    const res = await app.request("/finance/accounting?reference=LAX-BID-INV-01hx3");
    expect(res.status).toBe(200);
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ reference: "LAX-BID-INV-01hx3" }),
    );
  });

  it("refuses an unknown tab or company, or a reference that is not one", async () => {
    const { app, service } = build();
    expect((await app.request("/finance/accounting?tab=cancelled")).status).toBe(400);
    expect((await app.request("/finance/accounting?organisation=bid")).status).toBe(400);
    expect((await app.request("/finance/accounting?reference=not a reference")).status).toBe(400);
    expect(
      (await app.request("/finance/accounting?reference=DROP%20TABLE%20accounting")).status,
    ).toBe(400);
    expect(service.list).not.toHaveBeenCalled();
  });

  it("is a Finance page: read-only staff and other roles cannot open it", async () => {
    for (const role of ["read_only", "sales_manager"] as const) {
      const { app, service } = build([role]);
      expect((await app.request("/finance/accounting")).status, role).toBe(403);
      expect(service.list).not.toHaveBeenCalled();
    }
  });
});

describe("POST /finance/accounting/:id/try-again", () => {
  it("tries the document again as the person asking", async () => {
    const { app, service } = build(["finance"]);
    const res = await tryAgain(app);
    expect(res.status).toBe(200);
    expect(service.tryAgain).toHaveBeenCalledWith({ documentId: DOC_ID, actorUserId: "staff-1" });
    expect((await read(res)).data).toEqual({
      id: DOC_ID,
      reference: "LAX-BID-INV-a1",
      outcome: "requeued",
    });
  });

  it("needs an Idempotency-Key, and answers a repeated key without trying again", async () => {
    const { app, service } = build(["finance"]);
    const missing = await app.request(`/finance/accounting/${DOC_ID}/try-again`, {
      method: "POST",
    });
    expect(missing.status).toBe(400);
    await tryAgain(app, "key-0002-same");
    const replay = await tryAgain(app, "key-0002-same");
    expect(replay.status).toBe(200);
    expect(service.tryAgain).toHaveBeenCalledTimes(1);
  });

  it("refuses people without the finance read permission at the mount", async () => {
    for (const role of ["read_only", "sales_manager"] as const) {
      const { app, service } = build([role]);
      expect((await tryAgain(app)).status, role).toBe(403);
      expect(service.tryAgain).not.toHaveBeenCalled();
    }
  });

  it("refuses people who may read the page but lack the finance write permission", async () => {
    for (const role of ["read_only", "sales_manager"] as const) {
      expect(userHasAccessTo("staff", [role], ACCOUNTING_QUEUE_WRITE_ACCESS), role).toBe(false);
      const { app, service } = build([role], {}, passReadGate);
      expect((await tryAgain(app)).status, role).toBe(403);
      expect(service.tryAgain).not.toHaveBeenCalled();
    }
    // The same stand-in gate lets a finance person through, so the 403 above is the write guard's.
    const { app, service } = build(["finance"], {}, passReadGate);
    expect((await tryAgain(app)).status).toBe(200);
    expect(service.tryAgain).toHaveBeenCalledTimes(1);
  });

  it("refuses a document id that is not a uuid", async () => {
    const { app } = build();
    expect((await tryAgain(app, "key-0003-bad", "not-a-uuid")).status).toBe(400);
  });

  it("words each refusal with its own status", async () => {
    for (const [refusal, status] of [
      ["not_found", 404],
      ["not_allowed", 409],
      ["unreadable", 422],
    ] as const) {
      const { app } = build(["finance"], {
        tryAgain: async () => ({ ok: false, refusal, message: "Plain words." }),
      });
      const res = await tryAgain(app, `key-0004-${refusal}`);
      expect(res.status).toBe(status);
      expect(await read(res)).toEqual({ error: "Plain words.", code: refusal });
    }
  });
});
