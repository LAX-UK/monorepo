import {
  type CapabilityRequirement,
  DELIVERY_REPLAY_ACCESS,
  DISPUTE_ALLOCATION_WRITE_ACCESS,
  PAYMENT_MANUAL_REVIEW_WRITE_ACCESS,
  PAYMENT_WRITE_ACCESS,
  SALES_ACCESS,
  type StaffRoles,
  type UserRole,
  type UserStaffRole,
  WITHDRAWAL_DECISION_ACCESS,
  userHasAccessTo,
  userStaffRoles,
} from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { requireFinanceEntityWrite } from "../middleware/require-capability.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { InMemoryIdempotencyStore, stubStepUpGuard } from "../testing/staff-mutation-guards.js";
import { createAdminRoutes } from "./admin.js";

/**
 * The admin web UI decides whether to show an action from a shared rule in `@auction/types`
 * (`PAYMENT_WRITE_ACCESS`, `WITHDRAWAL_DECISION_ACCESS`, ...). The API route behind the action
 * must accept exactly the roles that rule allows. This test calls each real route as every
 * staff role and compares the answer with the rule, so a button can never be offered to a role
 * whose request the API refuses, and a route cannot be narrowed without the UI following.
 */

const SALE_ID = "00000000-0000-4000-8000-000000000001";
const LOT_ID = "00000000-0000-4000-8000-000000000002";
const PAYMENT_ID = "00000000-0000-4000-8000-000000000003";

function buildApp(staffRoles: StaffRoles | undefined) {
  const container = {
    env: { LOG_LEVEL: "silent", NODE_ENV: "test" } as never,
    admin: {
      requestLifecycle: {
        isSuspended: vi.fn().mockResolvedValue(false),
        reconcileAdminRequestCookie: vi.fn().mockResolvedValue(undefined),
      },
      stepUp: stubStepUpGuard(true),
      idempotencyStore: new InMemoryIdempotencyStore(),
    },
    redis: {},
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({
      id: "staff-user-id",
      role: "staff",
      staffRoles,
      scopes: ["bid.read", "bid.write"],
      identitySessionId: "session-1",
    }),
  };
  const app = new Hono();
  app.route("/admin", createAdminRoutes(container, authenticator));
  return app;
}

type AdminAction = {
  /** What the UI hides or shows. */
  name: string;
  rule: CapabilityRequirement;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  /** Roles the rule is documented to allow; pins the matrix so a change is a visible diff. */
  expectedRoles: UserStaffRole[];
};

const ACTIONS: AdminAction[] = [
  {
    name: "release a manual-review payment",
    rule: PAYMENT_MANUAL_REVIEW_WRITE_ACCESS,
    method: "POST",
    path: `/admin/payments/${PAYMENT_ID}/capture-and-process`,
    expectedRoles: ["administrator", "finance"],
  },
  {
    name: "refund a manual-review payment",
    rule: PAYMENT_MANUAL_REVIEW_WRITE_ACCESS,
    method: "POST",
    path: `/admin/payments/${PAYMENT_ID}/refund-buyer`,
    expectedRoles: ["administrator", "finance"],
  },
  {
    name: "allocate a dispute to invoices",
    rule: DISPUTE_ALLOCATION_WRITE_ACCESS,
    method: "POST",
    path: `/admin/finance/dispute-cases/${PAYMENT_ID}/allocation`,
    body: {
      expectedVersion: 1,
      lines: [{ paymentId: PAYMENT_ID, amountPence: 1000 }],
      note: "Split across the three invoices on the charge.",
    },
    expectedRoles: ["administrator", "finance"],
  },
  {
    name: "approve a withdrawal request",
    rule: WITHDRAWAL_DECISION_ACCESS,
    method: "POST",
    path: `/admin/lots/${LOT_ID}/approve-withdrawal-request`,
    expectedRoles: ["administrator", "sales_manager"],
  },
  {
    name: "decline a withdrawal request",
    rule: WITHDRAWAL_DECISION_ACCESS,
    method: "POST",
    path: `/admin/lots/${LOT_ID}/decline-withdrawal-request`,
    body: { reason: "The lot is already in a catalogue." },
    expectedRoles: ["administrator", "sales_manager"],
  },
  {
    name: "replay a dead-lettered delivery",
    rule: DELIVERY_REPLAY_ACCESS,
    method: "POST",
    path: "/admin/system/delivery/42/replay",
    expectedRoles: ["administrator"],
  },
  {
    name: "retry a webhook delivery",
    rule: DELIVERY_REPLAY_ACCESS,
    method: "POST",
    path: "/admin/system/delivery/webhook/retry",
    body: { eventKey: "evt_1" },
    expectedRoles: ["administrator"],
  },
  {
    name: "list sale registrations",
    rule: SALES_ACCESS,
    method: "GET",
    path: `/admin/sales/${SALE_ID}/registrations`,
    expectedRoles: ["administrator", "sales_manager"],
  },
  {
    name: "approve a sale registration",
    rule: SALES_ACCESS,
    method: "POST",
    path: `/admin/sales/${SALE_ID}/registrations/${PAYMENT_ID}/approve`,
    expectedRoles: ["administrator", "sales_manager"],
  },
];

async function statusFor(action: AdminAction, role: UserStaffRole): Promise<number> {
  const res = await buildApp([role]).request(`http://test${action.path}`, {
    method: action.method,
    ...(action.body !== undefined
      ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(action.body) }
      : {}),
  });
  return res.status;
}

describe("admin action rules match the API routes", () => {
  for (const action of ACTIONS) {
    describe(action.name, () => {
      it.each(userStaffRoles)("%s: the route answers as the shared rule says", async (role) => {
        const status = await statusFor(action, role);
        const uiShowsAction = userHasAccessTo("staff" as UserRole, [role], action.rule);
        const apiRefuses = status === 401 || status === 403;
        expect(apiRefuses).toBe(!uiShowsAction);
      });

      it("allows exactly the documented roles", () => {
        const allowed = userStaffRoles.filter((role) =>
          userHasAccessTo("staff" as UserRole, [role], action.rule),
        );
        expect([...allowed].sort()).toEqual([...action.expectedRoles].sort());
      });
    });
  }

  it("lets finance reach the payments list through the finance shell", async () => {
    const res = await buildApp(["finance"]).request("http://test/admin/payments");
    expect([401, 403]).not.toContain(res.status);
    const denied = await buildApp(["sales_manager"]).request("http://test/admin/payments");
    expect(denied.status).toBe(403);
  });
});

describe("payment capture and refund gate", () => {
  function paymentApp(staffRoles: StaffRoles | undefined) {
    const app = new Hono<{
      Variables: { userRole?: string; userStaffRoles?: StaffRoles | undefined };
    }>();
    app.use("*", async (c, next) => {
      c.set("userRole", "staff");
      c.set("userStaffRoles", staffRoles);
      await next();
    });
    app.post("/payments/:id/refund", requireFinanceEntityWrite, (c) => c.json({ ok: true }));
    return app;
  }

  it.each(userStaffRoles)("%s: the gate answers as PAYMENT_WRITE_ACCESS says", async (role) => {
    const res = await paymentApp([role]).request("/payments/pay-1/refund", { method: "POST" });
    expect(res.status === 200).toBe(
      userHasAccessTo("staff" as UserRole, [role], PAYMENT_WRITE_ACCESS),
    );
  });

  it("allows finance, who the finance screens are built for", async () => {
    const res = await paymentApp(["finance"]).request("/payments/pay-1/refund", {
      method: "POST",
    });
    expect(res.status).toBe(200);
  });
});
