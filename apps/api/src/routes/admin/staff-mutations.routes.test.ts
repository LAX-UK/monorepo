import { normalizeStaffRoles } from "@auction/types";
import type { StaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createTestStaffGuards } from "../../testing/staff-mutation-guards.js";
import type { AdminHono } from "./_shared.js";
import { attachAdminImpersonationRoutes } from "./impersonation.routes.js";
import { attachAdminLotsRoutes } from "./lots.routes.js";
import {
  attachAdminPaymentsListRoutes,
  attachAdminPaymentsManualReviewRoutes,
} from "./payments.routes.js";
import {
  attachAdminUsersDirectoryRoutes,
  attachAdminUsersManagementRoutes,
} from "./users.routes.js";

const ACTOR_ID = "b2e48c7a-1f09-4d35-8a6e-5d3c9f7e2b14";
const TARGET_ID = "6d1f0a52-8b3c-4e97-a4d6-2c9e7b1f5a08";
const LOT_ID = "c1a0b2d3-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const PAYMENT_ID = "d4e5f6a7-b8c9-4d0e-a1b2-c3d4e5f6a7b8";
const ENTITY_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const REASON = "Repeated chargebacks and a failed identity check.";
const STEP_UP = { error: "Recent sign-in required", code: "step_up_required" };

type Session = { role: string; staffRoles: StaffRoles | undefined };
const staff = (staffRoles: StaffRoles | undefined): Session => ({ role: "staff", staffRoles });

function mount(session: Session, options: { recent?: boolean } = {}) {
  const guards = createTestStaffGuards({ recent: options.recent ?? true });
  const platform: AdminHono = new Hono();
  platform.use("*", async (c, next) => {
    c.set("userId", ACTOR_ID);
    c.set("userRole", session.role);
    c.set("userStaffRoles", session.staffRoles);
    c.set("identitySessionId", "session-1");
    await next();
  });
  // Hono copies a sub-app's handlers when it is mounted, so mount on the first request, after
  // the test has attached its routes to `platform`.
  let built: Hono | undefined;
  const app = {
    request: (path: string, init?: RequestInit) => {
      if (!built) {
        built = new Hono();
        built.route("/admin", platform);
      }
      return built.request(path, init);
    },
  };
  return { app, platform, guards };
}

const json = (method: string, body?: unknown, headers: Record<string, string> = {}) => ({
  method,
  headers: { "content-type": "application/json", ...headers },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

function usersFixture(session: Session, options: { recent?: boolean } = {}) {
  const users = {
    setRole: vi.fn().mockResolvedValue({ ok: true }),
    setStaffRole: vi.fn().mockResolvedValue({ ok: true }),
    suspend: vi.fn().mockResolvedValue(undefined),
    unsuspend: vi.fn().mockResolvedValue(undefined),
    bulkSuspendOrUnsuspend: vi.fn().mockResolvedValue({ count: 2 }),
  };
  const container = { admin: { users, aml: {}, sourceOfFunds: {} } } as never;
  const { app, platform, guards } = mount(session, options);
  attachAdminUsersDirectoryRoutes(platform, container, guards);
  attachAdminUsersManagementRoutes(platform, container, guards);
  return { app, users };
}

const actorOf = (session: Session) => ({
  userId: ACTOR_ID,
  role: session.role,
  staffRoles: session.staffRoles,
});

describe("PATCH /admin/users/:userId/role (set-role)", () => {
  it("is registered at its own path and hands the actor and target on", async () => {
    const { app, users } = usersFixture(staff(["administrator"]));

    const res = await app.request(
      `/admin/users/${TARGET_ID}/role`,
      json("PATCH", { role: "staff", staffRole: "sales_manager" }),
    );

    expect(res.status).toBe(200);
    expect(users.setRole).toHaveBeenCalledWith(
      "staff",
      ACTOR_ID,
      TARGET_ID,
      "staff",
      ["administrator"],
      "sales_manager",
    );
  });

  it.each(["client_services", "client_services", "finance", "read_only"])(
    "refuses %s before asking for a sign-in",
    async (staffRoles) => {
      const { app, users } = usersFixture(staff(normalizeStaffRoles([staffRoles])), {
        recent: false,
      });

      const res = await app.request(
        `/admin/users/${TARGET_ID}/role`,
        json("PATCH", { role: "client" }),
      );

      expect(res.status).toBe(403);
      expect(await res.json()).not.toEqual(STEP_UP);
      expect(users.setRole).not.toHaveBeenCalled();
    },
  );

  it("asks for a fresh sign-in, and changes nothing", async () => {
    const { app, users } = usersFixture(staff(["administrator"]), { recent: false });

    const res = await app.request(
      `/admin/users/${TARGET_ID}/role`,
      json("PATCH", { role: "client" }),
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(STEP_UP);
    expect(users.setRole).not.toHaveBeenCalled();
  });

  it("passes the service's refusal through with its status", async () => {
    const { app, users } = usersFixture(staff(["administrator"]));
    users.setRole.mockResolvedValue({ ok: false, status: 409, message: "last administrator" });

    const res = await app.request(
      `/admin/users/${TARGET_ID}/role`,
      json("PATCH", { role: "client" }),
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "last administrator" });
  });
});

describe("PATCH /admin/users/:userId/staff-role", () => {
  it("changes the role for a administrator with a fresh sign-in", async () => {
    const { app, users } = usersFixture(staff(["administrator"]));

    const res = await app.request(
      `/admin/users/${TARGET_ID}/staff-role`,
      json("PATCH", { staffRole: "finance" }),
    );

    expect(res.status).toBe(200);
    expect(users.setStaffRole).toHaveBeenCalledWith("staff", ACTOR_ID, TARGET_ID, "finance", [
      "administrator",
    ]);
  });

  it("asks for a fresh sign-in, and changes nothing", async () => {
    const { app, users } = usersFixture(staff(["administrator"]), { recent: false });

    const res = await app.request(
      `/admin/users/${TARGET_ID}/staff-role`,
      json("PATCH", { staffRole: "finance" }),
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(STEP_UP);
    expect(users.setStaffRole).not.toHaveBeenCalled();
  });

  it.each(["client_services", "sales_manager"])("refuses %s", async (staffRoles) => {
    const { app, users } = usersFixture(staff(normalizeStaffRoles([staffRoles])));

    const res = await app.request(
      `/admin/users/${TARGET_ID}/staff-role`,
      json("PATCH", { staffRole: "finance" }),
    );

    expect(res.status).toBe(403);
    expect(users.setStaffRole).not.toHaveBeenCalled();
  });
});

describe("POST /admin/users/:userId/suspend and unsuspend", () => {
  it.each(["administrator", "client_services"])(
    "lets %s suspend, with the actor and reason",
    async (staffRoles) => {
      const { app, users } = usersFixture(staff(normalizeStaffRoles([staffRoles])));

      const res = await app.request(
        `/admin/users/${TARGET_ID}/suspend`,
        json("POST", { reason: REASON }),
      );

      expect(res.status).toBe(200);
      expect(users.suspend).toHaveBeenCalledWith(
        actorOf(staff(normalizeStaffRoles([staffRoles]))),
        TARGET_ID,
        REASON,
      );
    },
  );

  it.each(["finance", "read_only", "fulfilment"])("refuses %s", async (staffRoles) => {
    const { app, users } = usersFixture(staff(normalizeStaffRoles([staffRoles])));

    const suspend = await app.request(
      `/admin/users/${TARGET_ID}/suspend`,
      json("POST", { reason: REASON }),
    );
    const unsuspend = await app.request(`/admin/users/${TARGET_ID}/unsuspend`, json("POST"));

    expect(suspend.status).toBe(403);
    expect(unsuspend.status).toBe(403);
    expect(users.suspend).not.toHaveBeenCalled();
    expect(users.unsuspend).not.toHaveBeenCalled();
  });

  it.each([
    ["no reason", {}],
    ["a blank reason", { reason: "     " }],
    ["a short reason", { reason: "spam" }],
    ["an over-long reason", { reason: "x".repeat(501) }],
  ])("rejects %s", async (_label, body) => {
    const { app, users } = usersFixture(staff(["administrator"]));

    const res = await app.request(`/admin/users/${TARGET_ID}/suspend`, json("POST", body));

    expect(res.status).toBe(400);
    expect(users.suspend).not.toHaveBeenCalled();
  });

  it("asks for a fresh sign-in before suspending or restoring", async () => {
    const { app, users } = usersFixture(staff(["administrator"]), { recent: false });

    const suspend = await app.request(
      `/admin/users/${TARGET_ID}/suspend`,
      json("POST", { reason: REASON }),
    );
    const unsuspend = await app.request(`/admin/users/${TARGET_ID}/unsuspend`, json("POST"));

    for (const res of [suspend, unsuspend]) {
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual(STEP_UP);
    }
    expect(users.suspend).not.toHaveBeenCalled();
    expect(users.unsuspend).not.toHaveBeenCalled();
  });

  it("unsuspends with the actor recorded", async () => {
    const { app, users } = usersFixture(staff(["client_services"]));

    const res = await app.request(`/admin/users/${TARGET_ID}/unsuspend`, json("POST"));

    expect(res.status).toBe(200);
    expect(users.unsuspend).toHaveBeenCalledWith(actorOf(staff(["client_services"])), TARGET_ID);
  });
});

describe("POST /admin/users/bulk", () => {
  const ids = [TARGET_ID, "11111111-2222-4333-8444-555555555555"];

  it("suspends a batch with the actor and reason", async () => {
    const { app, users } = usersFixture(staff(["client_services"]));

    const res = await app.request(
      "/admin/users/bulk",
      json("POST", { ids, op: "suspend", reason: REASON }),
    );

    expect(res.status).toBe(200);
    expect(users.bulkSuspendOrUnsuspend).toHaveBeenCalledWith({
      actor: actorOf(staff(["client_services"])),
      ids,
      op: "suspend",
      reason: REASON,
    });
  });

  it("requires a reason to suspend but not to restore", async () => {
    const { app, users } = usersFixture(staff(["administrator"]));

    const noReason = await app.request("/admin/users/bulk", json("POST", { ids, op: "suspend" }));
    const restore = await app.request("/admin/users/bulk", json("POST", { ids, op: "unsuspend" }));

    expect(noReason.status).toBe(400);
    expect(restore.status).toBe(200);
    expect(users.bulkSuspendOrUnsuspend).toHaveBeenCalledOnce();
  });

  it("asks for a fresh sign-in, and changes nothing", async () => {
    const { app, users } = usersFixture(staff(["administrator"]), { recent: false });

    const res = await app.request(
      "/admin/users/bulk",
      json("POST", { ids, op: "suspend", reason: REASON }),
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(STEP_UP);
    expect(users.bulkSuspendOrUnsuspend).not.toHaveBeenCalled();
  });

  it.each(["fulfilment", "finance"])("refuses %s", async (staffRoles) => {
    const { app, users } = usersFixture(staff(normalizeStaffRoles([staffRoles])));

    const res = await app.request(
      "/admin/users/bulk",
      json("POST", { ids, op: "suspend", reason: REASON }),
    );

    expect(res.status).toBe(403);
    expect(users.bulkSuspendOrUnsuspend).not.toHaveBeenCalled();
  });
});

describe("withdrawal decisions", () => {
  function lotsFixture(session: Session, options: { recent?: boolean } = {}) {
    const lots = {
      approveWithdrawalRequest: vi.fn().mockResolvedValue({ ok: true, data: { id: LOT_ID } }),
      declineWithdrawalRequest: vi.fn().mockResolvedValue({ ok: true, data: { id: LOT_ID } }),
    };
    const { app, platform, guards } = mount(session, options);
    attachAdminLotsRoutes(platform, { admin: { lots, reviewTasks: {} } } as never, guards);
    return { app, lots };
  }

  it.each(["administrator", "sales_manager"])("lets %s approve and decline", async (staffRoles) => {
    const { app, lots } = lotsFixture(staff(normalizeStaffRoles([staffRoles])));

    const approve = await app.request(
      `/admin/lots/${LOT_ID}/approve-withdrawal-request`,
      json("POST"),
    );
    const decline = await app.request(
      `/admin/lots/${LOT_ID}/decline-withdrawal-request`,
      json("POST", { reason: "Already catalogued." }),
    );

    expect(approve.status).toBe(200);
    expect(decline.status).toBe(200);
    expect(lots.approveWithdrawalRequest).toHaveBeenCalledOnce();
    expect(lots.declineWithdrawalRequest).toHaveBeenCalledOnce();
  });

  it.each(["finance", "client_services", "read_only"])("refuses %s", async (staffRoles) => {
    const { app, lots } = lotsFixture(staff(normalizeStaffRoles([staffRoles])));

    const res = await app.request(`/admin/lots/${LOT_ID}/approve-withdrawal-request`, json("POST"));

    expect(res.status).toBe(403);
    expect(lots.approveWithdrawalRequest).not.toHaveBeenCalled();
  });

  it("asks for a fresh sign-in before approving or declining", async () => {
    const { app, lots } = lotsFixture(staff(["administrator"]), { recent: false });

    const approve = await app.request(
      `/admin/lots/${LOT_ID}/approve-withdrawal-request`,
      json("POST"),
    );
    const decline = await app.request(
      `/admin/lots/${LOT_ID}/decline-withdrawal-request`,
      json("POST", { reason: "Already catalogued." }),
    );

    for (const res of [approve, decline]) {
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual(STEP_UP);
    }
    expect(lots.approveWithdrawalRequest).not.toHaveBeenCalled();
    expect(lots.declineWithdrawalRequest).not.toHaveBeenCalled();
  });
});

describe("manual-review payments", () => {
  function paymentsFixture(session: Session, options: { recent?: boolean } = {}) {
    const ok = { match: (onOk: () => unknown) => onOk() };
    const payments = {
      releaseManualReviewForCapture: vi.fn().mockResolvedValue(ok),
      refundManualReviewPayment: vi.fn().mockResolvedValue(ok),
    };
    const { app, platform, guards } = mount(session, options);
    const container = { admin: { payments, manualReviewPayments: {} } } as never;
    attachAdminPaymentsListRoutes(platform, container);
    attachAdminPaymentsManualReviewRoutes(platform, container, guards);
    return { app, payments };
  }
  const key = (value: string) => ({ "idempotency-key": value });

  it.each(["administrator", "finance"])(
    "lets %s capture and refund with a key",
    async (staffRoles) => {
      const { app, payments } = paymentsFixture(staff(normalizeStaffRoles([staffRoles])));

      const capture = await app.request(
        `/admin/payments/${PAYMENT_ID}/capture-and-process`,
        json("POST", undefined, key("capture-key-0001")),
      );
      const refund = await app.request(
        `/admin/payments/${PAYMENT_ID}/refund-buyer`,
        json("POST", { reason: REASON }, key("refund-key-0001")),
      );

      expect(capture.status).toBe(200);
      expect(refund.status).toBe(200);
      expect(payments.releaseManualReviewForCapture).toHaveBeenCalledWith(
        ACTOR_ID,
        "staff",
        PAYMENT_ID,
        normalizeStaffRoles([staffRoles]),
      );
      expect(payments.refundManualReviewPayment).toHaveBeenCalledWith(
        ACTOR_ID,
        "staff",
        PAYMENT_ID,
        normalizeStaffRoles([staffRoles]),
        REASON,
      );
    },
  );

  it.each(["sales_manager", "client_services", "read_only"])("refuses %s", async (staffRoles) => {
    const { app, payments } = paymentsFixture(staff(normalizeStaffRoles([staffRoles])), {
      recent: false,
    });

    const res = await app.request(
      `/admin/payments/${PAYMENT_ID}/refund-buyer`,
      json("POST", { reason: REASON }, key("refund-key-0002")),
    );

    expect(res.status).toBe(403);
    expect(await res.json()).not.toEqual(STEP_UP);
    expect(payments.refundManualReviewPayment).not.toHaveBeenCalled();
  });

  it("asks for a fresh sign-in before anything else, including the key check", async () => {
    const { app, payments } = paymentsFixture(staff(["finance"]), { recent: false });

    const capture = await app.request(
      `/admin/payments/${PAYMENT_ID}/capture-and-process`,
      json("POST"),
    );
    const refund = await app.request(
      `/admin/payments/${PAYMENT_ID}/refund-buyer`,
      json("POST", { reason: REASON }, key("refund-key-0003")),
    );

    for (const res of [capture, refund]) {
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual(STEP_UP);
    }
    expect(payments.releaseManualReviewForCapture).not.toHaveBeenCalled();
    expect(payments.refundManualReviewPayment).not.toHaveBeenCalled();
  });

  it("refuses a capture or refund without an Idempotency-Key", async () => {
    const { app, payments } = paymentsFixture(staff(["finance"]));

    const capture = await app.request(
      `/admin/payments/${PAYMENT_ID}/capture-and-process`,
      json("POST"),
    );
    const refund = await app.request(
      `/admin/payments/${PAYMENT_ID}/refund-buyer`,
      json("POST", { reason: REASON }),
    );

    expect(capture.status).toBe(400);
    expect(refund.status).toBe(400);
    expect(payments.releaseManualReviewForCapture).not.toHaveBeenCalled();
    expect(payments.refundManualReviewPayment).not.toHaveBeenCalled();
  });

  it.each([
    ["no reason", {}],
    ["a blank reason", { reason: "     " }],
    ["a short reason", { reason: "oops" }],
  ])("rejects a refund with %s", async (_label, body) => {
    const { app, payments } = paymentsFixture(staff(["finance"]));

    const res = await app.request(
      `/admin/payments/${PAYMENT_ID}/refund-buyer`,
      json("POST", body, key("refund-key-0004")),
    );

    expect(res.status).toBe(400);
    expect(payments.refundManualReviewPayment).not.toHaveBeenCalled();
  });

  it("refunds once when the same request is sent twice, and replays the answer", async () => {
    const { app, payments } = paymentsFixture(staff(["finance"]));
    const send = () =>
      app.request(
        `/admin/payments/${PAYMENT_ID}/refund-buyer`,
        json("POST", { reason: REASON }, key("refund-key-0005")),
      );

    const first = await send();
    const second = await send();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.headers.get("Idempotent-Replayed")).toBe("true");
    expect(await second.json()).toEqual({ ok: true });
    expect(payments.refundManualReviewPayment).toHaveBeenCalledOnce();
  });

  it("captures once when the same request is sent twice", async () => {
    const { app, payments } = paymentsFixture(staff(["finance"]));
    const send = () =>
      app.request(
        `/admin/payments/${PAYMENT_ID}/capture-and-process`,
        json("POST", undefined, key("capture-key-0002")),
      );

    await send();
    const second = await send();

    expect(second.headers.get("Idempotent-Replayed")).toBe("true");
    expect(payments.releaseManualReviewForCapture).toHaveBeenCalledOnce();
  });

  it("does not replay a refund that failed, so it can be retried with the same key", async () => {
    const { app, payments } = paymentsFixture(staff(["finance"]));
    payments.refundManualReviewPayment.mockResolvedValueOnce({
      match: (_ok: () => unknown, onErr: (e: { message: string; status: number }) => unknown) =>
        onErr({ message: "Payment is not in manual review", status: 409 }),
    });
    const send = () =>
      app.request(
        `/admin/payments/${PAYMENT_ID}/refund-buyer`,
        json("POST", { reason: REASON }, key("refund-key-0006")),
      );

    const failed = await send();
    const retried = await send();

    expect(failed.status).toBe(409);
    expect(retried.status).toBe(200);
    expect(payments.refundManualReviewPayment).toHaveBeenCalledTimes(2);
  });
});

describe("impersonation start", () => {
  function impersonationFixture(session: Session, options: { recent?: boolean } = {}) {
    const impersonation = {
      startImpersonation: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          actingCookie: "cookie",
          sessionId: "s",
          expiresAt: "2099-01-01",
          displayName: "Org",
        },
      }),
      lookupForImpersonation: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: ENTITY_ID, displayName: "Org", status: "active" },
      }),
      endImpersonation: vi.fn(),
      recordFailedEnd: vi.fn(),
    };
    const { app, platform, guards } = mount(session, options);
    attachAdminImpersonationRoutes(platform, { admin: { impersonation } } as never, guards);
    return { app, impersonation };
  }

  it("lets a administrator with a fresh sign-in start", async () => {
    const { app, impersonation } = impersonationFixture(staff(["administrator"]));

    const res = await app.request(
      "/admin/impersonation/start",
      json("POST", { legalEntityId: ENTITY_ID }),
    );

    expect(res.status).toBe(200);
    expect(impersonation.startImpersonation).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: ACTOR_ID, legalEntityId: ENTITY_ID }),
    );
  });

  it("asks for a fresh sign-in, but still allows the read-only lookup", async () => {
    const { app, impersonation } = impersonationFixture(staff(["administrator"]), {
      recent: false,
    });

    const start = await app.request(
      "/admin/impersonation/start",
      json("POST", { legalEntityId: ENTITY_ID }),
    );
    const lookup = await app.request(`/admin/impersonation/lookup?legalEntityId=${ENTITY_ID}`);

    expect(start.status).toBe(403);
    expect(await start.json()).toEqual(STEP_UP);
    expect(impersonation.startImpersonation).not.toHaveBeenCalled();
    expect(lookup.status).toBe(200);
  });

  it.each(["client_services", "sales_manager", "finance"])("refuses %s", async (staffRoles) => {
    const { app, impersonation } = impersonationFixture(staff(normalizeStaffRoles([staffRoles])));

    const res = await app.request(
      "/admin/impersonation/start",
      json("POST", { legalEntityId: ENTITY_ID }),
    );

    expect(res.status).toBe(403);
    expect(impersonation.startImpersonation).not.toHaveBeenCalled();
  });
});
