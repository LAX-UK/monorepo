import { normalizeStaffRoles } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { PayoutStatusTransitionError } from "../services/interfaces/payout.js";
import { InMemoryIdempotencyStore, stubStepUpGuard } from "../testing/staff-mutation-guards.js";
import { createAdminPayoutRoutes } from "./payouts.js";

const PAYOUT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ENTITY_ID = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const ACTOR_ID = "staff-user-1";
const TRANSFER_REF = "transfer-ref-0001";
const REVERSE_REASON = "Duplicate payment, bookkeeping correction required.";
const STEP_UP = { error: "Recent sign-in required", code: "step_up_required" };

function mount(
  staffRole: string,
  options: { recent?: boolean; store?: InMemoryIdempotencyStore } = {},
) {
  const store = options.store ?? new InMemoryIdempotencyStore();
  const payouts = {
    markPaid: vi.fn().mockResolvedValue({ id: PAYOUT_ID, status: "paid" }),
    retryFailedTransfer: vi
      .fn()
      .mockResolvedValue({ ok: true, payout: { id: PAYOUT_ID, status: "in_transit" } }),
    adminManualReverse: vi.fn().mockResolvedValue({ id: PAYOUT_ID, status: "reversed" }),
    createSettlement: vi.fn().mockResolvedValue({ ok: true, payout: { id: PAYOUT_ID, lines: [] } }),
  };
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    admin: {
      payouts,
      stepUp: stubStepUpGuard(options.recent ?? true),
      idempotencyStore: store,
    },
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({
      id: ACTOR_ID,
      role: "staff",
      staffRoles: normalizeStaffRoles([staffRole]),
      scopes: ["bid.write"],
      identitySessionId: "session-1",
    }),
  };
  const app = new Hono();
  app.route("/admin/payouts", createAdminPayoutRoutes(container, authenticator));
  return { app, payouts, store };
}

const post = (app: Hono, path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(`/admin/payouts${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

const key = (value: string) => ({ "idempotency-key": value });

describe("POST /admin/payouts/:payoutId/mark-paid", () => {
  it.each(["administrator", "finance"])(
    "lets %s mark a payout paid with the actor recorded",
    async (staffRole) => {
      const { app, payouts } = mount(staffRole);

      const res = await post(
        app,
        `/${PAYOUT_ID}/mark-paid`,
        { stripeTransferId: TRANSFER_REF },
        key("mark-paid-key-1"),
      );

      expect(res.status).toBe(200);
      expect(payouts.markPaid).toHaveBeenCalledWith(ACTOR_ID, PAYOUT_ID, {
        stripeTransferId: TRANSFER_REF,
      });
    },
  );

  it.each(["sales_manager", "client_services", "read_only"])("refuses %s", async (staffRole) => {
    const { app, payouts } = mount(staffRole, { recent: false });

    const res = await post(
      app,
      `/${PAYOUT_ID}/mark-paid`,
      { stripeTransferId: TRANSFER_REF },
      key("mark-paid-key-2"),
    );

    expect(res.status).toBe(403);
    expect(await res.json()).not.toEqual(STEP_UP);
    expect(payouts.markPaid).not.toHaveBeenCalled();
  });

  it("asks for a fresh sign-in, and marks nothing", async () => {
    const { app, payouts } = mount("finance", { recent: false });

    const res = await post(
      app,
      `/${PAYOUT_ID}/mark-paid`,
      { stripeTransferId: TRANSFER_REF },
      key("mark-paid-key-3"),
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(STEP_UP);
    expect(payouts.markPaid).not.toHaveBeenCalled();
  });

  it("refuses a request without an Idempotency-Key", async () => {
    const { app, payouts } = mount("finance");

    const res = await post(app, `/${PAYOUT_ID}/mark-paid`, { stripeTransferId: TRANSFER_REF });

    expect(res.status).toBe(400);
    expect(payouts.markPaid).not.toHaveBeenCalled();
  });

  it("marks paid once when the same request is replayed", async () => {
    const { app, payouts } = mount("finance");
    const send = () =>
      post(
        app,
        `/${PAYOUT_ID}/mark-paid`,
        { stripeTransferId: TRANSFER_REF },
        key("mark-paid-key-4"),
      );

    const first = await send();
    const second = await send();

    expect(second.status).toBe(200);
    expect(second.headers.get("Idempotent-Replayed")).toBe("true");
    expect(await second.json()).toEqual(await first.json());
    expect(payouts.markPaid).toHaveBeenCalledOnce();
  });

  it("refuses the same key for a different transfer reference", async () => {
    const { app, payouts } = mount("finance");
    await post(
      app,
      `/${PAYOUT_ID}/mark-paid`,
      { stripeTransferId: TRANSFER_REF },
      key("mark-paid-key-5"),
    );

    const res = await post(
      app,
      `/${PAYOUT_ID}/mark-paid`,
      { stripeTransferId: "transfer-ref-9999" },
      key("mark-paid-key-5"),
    );

    expect(res.status).toBe(422);
    expect(payouts.markPaid).toHaveBeenCalledOnce();
  });

  it("does not cache a conflict, so a corrected retry with the same key runs", async () => {
    const { app, payouts } = mount("finance");
    const { PayoutStatusTransitionError } = await import("../services/interfaces/payout.js");
    payouts.markPaid.mockRejectedValueOnce(new PayoutStatusTransitionError("payout_already_paid"));
    const send = () =>
      post(
        app,
        `/${PAYOUT_ID}/mark-paid`,
        { stripeTransferId: TRANSFER_REF },
        key("mark-paid-key-6"),
      );

    const failed = await send();
    const retried = await send();

    expect(failed.status).toBe(409);
    expect(retried.status).toBe(200);
    expect(payouts.markPaid).toHaveBeenCalledTimes(2);
  });
});

describe("payout transition conflicts", () => {
  it("answers 409 with the conflict code when mark-paid loses a race", async () => {
    const { app, payouts } = mount("finance");
    const { PayoutStatusTransitionError } = await import("../services/interfaces/payout.js");
    payouts.markPaid.mockRejectedValueOnce(new PayoutStatusTransitionError("payout_state_changed"));

    const res = await post(
      app,
      `/${PAYOUT_ID}/mark-paid`,
      { stripeTransferId: TRANSFER_REF },
      key("mark-paid-key-7"),
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "payout_state_changed" });
  });

  it("answers 409 when a reversal loses a race", async () => {
    const { app, payouts } = mount("administrator");
    const { PayoutStatusTransitionError } = await import("../services/interfaces/payout.js");
    payouts.adminManualReverse.mockRejectedValueOnce(
      new PayoutStatusTransitionError("payout_already_reversed"),
    );

    const res = await post(
      app,
      `/${PAYOUT_ID}/reverse`,
      { reason: REVERSE_REASON, confirmationPhrase: `REVERSE PAYOUT ${PAYOUT_ID}` },
      key("reverse-key-409"),
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "payout_already_reversed" });
  });
});

describe("POST /admin/payouts/:payoutId/reverse", () => {
  const body = { reason: REVERSE_REASON, confirmationPhrase: `REVERSE PAYOUT ${PAYOUT_ID}` };

  it("asks for a fresh sign-in, and reverses nothing", async () => {
    const { app, payouts } = mount("administrator", { recent: false });

    const res = await post(app, `/${PAYOUT_ID}/reverse`, body, key("reverse-key-001"));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(STEP_UP);
    expect(payouts.adminManualReverse).not.toHaveBeenCalled();
  });

  it("reverses once when the same request is replayed", async () => {
    const { app, payouts } = mount("administrator");
    const send = () => post(app, `/${PAYOUT_ID}/reverse`, body, key("reverse-key-002"));

    await send();
    const second = await send();

    expect(second.headers.get("Idempotent-Replayed")).toBe("true");
    expect(payouts.adminManualReverse).toHaveBeenCalledOnce();
  });

  it("refuses a request without an Idempotency-Key", async () => {
    const { app, payouts } = mount("administrator");

    const res = await post(app, `/${PAYOUT_ID}/reverse`, body);

    expect(res.status).toBe(400);
    expect(payouts.adminManualReverse).not.toHaveBeenCalled();
  });
});

describe("POST /admin/payouts/run-settlement", () => {
  const run = { legalEntityId: ENTITY_ID, dryRun: false };

  it.each(["administrator", "finance"])(
    "lets %s run a settlement for one entity",
    async (staffRole) => {
      const { app, payouts } = mount(staffRole);

      const res = await post(app, "/run-settlement", run, key("settlement-key-1"));

      expect(res.status).toBe(201);
      expect(payouts.createSettlement).toHaveBeenCalledWith(ACTOR_ID, {
        legalEntityId: ENTITY_ID,
        periodStart: new Date(0),
        periodEnd: expect.any(Date),
      });
    },
  );

  it.each(["sales_manager", "client_services"])("refuses %s", async (staffRole) => {
    const { app, payouts } = mount(staffRole);

    const res = await post(app, "/run-settlement", run, key("settlement-key-2"));

    expect(res.status).toBe(403);
    expect(payouts.createSettlement).not.toHaveBeenCalled();
  });

  it("asks for a fresh sign-in, and settles nothing", async () => {
    const { app, payouts } = mount("finance", { recent: false });

    const res = await post(app, "/run-settlement", run, key("settlement-key-3"));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(STEP_UP);
    expect(payouts.createSettlement).not.toHaveBeenCalled();
  });

  it("refuses a request without an Idempotency-Key", async () => {
    const { app, payouts } = mount("finance");

    const res = await post(app, "/run-settlement", run);

    expect(res.status).toBe(400);
    expect(payouts.createSettlement).not.toHaveBeenCalled();
  });

  it("requires a legal entity", async () => {
    const { app, payouts } = mount("finance");

    const res = await post(app, "/run-settlement", { dryRun: false }, key("settlement-key-4"));

    expect(res.status).toBe(400);
    expect(payouts.createSettlement).not.toHaveBeenCalled();
  });

  it("creates one payout when the same request is replayed", async () => {
    const { app, payouts } = mount("finance");
    const send = () => post(app, "/run-settlement", run, key("settlement-key-5"));

    const first = await send();
    const second = await send();

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.headers.get("Idempotent-Replayed")).toBe("true");
    expect(await second.json()).toEqual(await first.json());
    expect(payouts.createSettlement).toHaveBeenCalledOnce();
  });

  it("answers 409 when nothing is pending, so a second run under a new key is a no-op", async () => {
    const { app, payouts } = mount("finance");
    payouts.createSettlement.mockResolvedValueOnce({
      ok: true,
      payout: { id: PAYOUT_ID, lines: [] },
    });
    payouts.createSettlement.mockResolvedValueOnce({ ok: false, reason: "no_pending_payments" });

    const first = await post(app, "/run-settlement", run, key("settlement-key-6"));
    const second = await post(app, "/run-settlement", run, key("settlement-key-7"));

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ error: "no_pending_payments" });
  });

  it("refuses a concurrent run for the same entity and lets the same entity run again afterwards", async () => {
    const { app, payouts } = mount("finance");
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    payouts.createSettlement.mockImplementationOnce(async () => {
      await gate;
      return { ok: true, payout: { id: PAYOUT_ID, lines: [] } };
    });

    const first = post(app, "/run-settlement", run, key("settlement-key-8"));
    for (let i = 0; i < 50 && payouts.createSettlement.mock.calls.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 2));
    }
    const concurrent = await post(app, "/run-settlement", run, key("settlement-key-9"));
    release();
    await first;
    const later = await post(app, "/run-settlement", run, key("settlement-key-10"));

    expect(concurrent.status).toBe(409);
    expect(await concurrent.json()).toEqual({ error: "settlement_in_progress" });
    expect(later.status).toBe(201);
    expect(payouts.createSettlement).toHaveBeenCalledTimes(2);
  });

  it("releases the entity lock when the settlement throws", async () => {
    const { app, payouts, store } = mount("finance");
    payouts.createSettlement.mockRejectedValueOnce(new Error("db down"));

    const failed = await post(app, "/run-settlement", run, key("settlement-key-11"));
    const retried = await post(app, "/run-settlement", run, key("settlement-key-11"));

    expect(failed.status).toBe(500);
    expect(retried.status).toBe(201);
    expect([...store.entries.keys()].some((k) => k.startsWith("admin-settlement-lock:"))).toBe(
      false,
    );
  });
});

describe("POST /admin/payouts/:payoutId/retry-transfer", () => {
  const retry = (app: Hono, idem: string, body: unknown = { confirmed: true }) =>
    post(app, `/${PAYOUT_ID}/retry-transfer`, body, key(idem));

  it.each(["administrator", "finance"])("lets %s retry with the actor recorded", async (role) => {
    const { app, payouts } = mount(role);

    const res = await retry(app, "retry-key-0001");

    expect(res.status).toBe(200);
    expect(payouts.retryFailedTransfer).toHaveBeenCalledWith(ACTOR_ID, PAYOUT_ID);
  });

  it.each(["sales_manager", "client_services", "read_only"])("refuses %s", async (role) => {
    const { app, payouts } = mount(role);

    const res = await retry(app, "retry-key-0002");

    expect(res.status).toBe(403);
    expect(payouts.retryFailedTransfer).not.toHaveBeenCalled();
  });

  it("asks for a fresh sign-in, and retries nothing", async () => {
    const { app, payouts } = mount("finance", { recent: false });

    const res = await retry(app, "retry-key-0003");

    expect(await res.json()).toEqual(STEP_UP);
    expect(payouts.retryFailedTransfer).not.toHaveBeenCalled();
  });

  it("refuses a request that was not confirmed", async () => {
    const { app, payouts } = mount("finance");

    const res = await retry(app, "retry-key-0004", {});

    expect(res.status).toBe(400);
    expect(payouts.retryFailedTransfer).not.toHaveBeenCalled();
  });

  it("refuses a request without an Idempotency-Key", async () => {
    const { app, payouts } = mount("finance");

    const res = await post(app, `/${PAYOUT_ID}/retry-transfer`, { confirmed: true });

    expect(res.status).toBe(400);
    expect(payouts.retryFailedTransfer).not.toHaveBeenCalled();
  });

  it("retries once when the same request is replayed", async () => {
    const { app, payouts } = mount("finance");

    await retry(app, "retry-key-0005");
    const second = await retry(app, "retry-key-0005");

    expect(second.headers.get("Idempotent-Replayed")).toBe("true");
    expect(payouts.retryFailedTransfer).toHaveBeenCalledOnce();
  });

  it("reports a transfer that could not start as a conflict", async () => {
    const { app, payouts } = mount("finance");
    payouts.retryFailedTransfer.mockResolvedValue({ ok: false, reason: "connect_not_ready" });

    const res = await retry(app, "retry-key-0006");

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "connect_not_ready" });
  });

  it("reports a payout that is not failed as a conflict", async () => {
    const { app, payouts } = mount("finance");
    payouts.retryFailedTransfer.mockRejectedValue(
      new PayoutStatusTransitionError("payout_not_failed"),
    );

    const res = await retry(app, "retry-key-0007");

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "payout_not_failed" });
  });
});
