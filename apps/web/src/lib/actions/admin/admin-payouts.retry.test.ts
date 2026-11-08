import { beforeEach, describe, expect, it, vi } from "vitest";

const authedServerFetch = vi.fn();
const denyUnlessAdminCapability = vi.fn();

vi.mock("@/lib/data/http/authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => authedServerFetch(...args),
}));
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  denyUnlessAdminCapability: (...args: unknown[]) => denyUnlessAdminCapability(...args),
}));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: (_name: string, run: () => unknown) => run(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const {
  adminAdoptBlockedPayoutTransferResultAction,
  adminReleaseBlockedPayoutResultAction,
  adminRetryPayoutTransferResultAction,
} = await import("./admin-payouts");

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("adminRetryPayoutTransferResultAction", () => {
  beforeEach(() => {
    authedServerFetch.mockReset();
    denyUnlessAdminCapability.mockReset().mockResolvedValue(null);
  });

  it("posts a confirmed retry with the dialog's idempotency key", async () => {
    authedServerFetch.mockResolvedValue(json(200, { data: {} }));

    const result = await adminRetryPayoutTransferResultAction("p1", {
      idempotencyKey: "retry-dialog-key-1",
    });

    expect(result.ok).toBe(true);
    const [path, init] = authedServerFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/admin/payouts/p1/retry-transfer");
    expect(init.body).toBe(JSON.stringify({ confirmed: true }));
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("retry-dialog-key-1");
  });

  it("does not call the API for someone without finance access", async () => {
    const denied = { ok: false, error: "No access" };
    denyUnlessAdminCapability.mockResolvedValue(denied);

    await expect(adminRetryPayoutTransferResultAction("p1")).resolves.toBe(denied);
    expect(authedServerFetch).not.toHaveBeenCalled();
  });

  it("explains a refusal in fixed copy, not the API's code", async () => {
    authedServerFetch.mockResolvedValue(json(409, { error: "connect_not_ready" }));

    const result = await adminRetryPayoutTransferResultAction("p1");

    expect(result).toMatchObject({
      ok: false,
      error: expect.stringContaining("cannot receive transfers yet"),
    });
  });

  it("explains the retry cool-off in fixed copy", async () => {
    authedServerFetch.mockResolvedValue(json(409, { error: "retry_too_soon" }));

    await expect(adminRetryPayoutTransferResultAction("p1")).resolves.toMatchObject({
      ok: false,
      error: "Wait a few minutes: Stripe may still be finishing the last attempt",
    });
  });
});

describe("blocked payout resolution actions", () => {
  const REASON = "Checked Stripe: tr_a is the live transfer";

  beforeEach(() => {
    authedServerFetch.mockReset();
    denyUnlessAdminCapability.mockReset().mockResolvedValue(null);
  });

  it("posts an adoption with the transfer, the reason and the dialog's key", async () => {
    authedServerFetch.mockResolvedValue(json(200, { data: {} }));

    const result = await adminAdoptBlockedPayoutTransferResultAction("p1", {
      stripeTransferId: " tr_a ",
      reason: ` ${REASON} `,
      idempotencyKey: "adopt-dialog-key-1",
    });

    expect(result.ok).toBe(true);
    const [path, init] = authedServerFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/admin/payouts/p1/resolve-blocked");
    expect(JSON.parse(init.body as string)).toEqual({
      resolution: "adopt_transfer",
      stripeTransferId: "tr_a",
      reason: REASON,
    });
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("adopt-dialog-key-1");
  });

  it("posts a release with the confirmation and the reason", async () => {
    authedServerFetch.mockResolvedValue(json(200, { data: {} }));

    const result = await adminReleaseBlockedPayoutResultAction("p1", {
      reason: REASON,
      noLiveTransferConfirmed: true,
      idempotencyKey: "release-dialog-key-1",
    });

    expect(result.ok).toBe(true);
    const [path, init] = authedServerFetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe("/admin/payouts/p1/resolve-blocked");
    expect(JSON.parse(init.body as string)).toEqual({
      resolution: "release_to_failed",
      noLiveTransferConfirmed: true,
      reason: REASON,
    });
  });

  it("does not call the API for someone without finance access", async () => {
    const denied = { ok: false, error: "No access" };
    denyUnlessAdminCapability.mockResolvedValue(denied);

    await expect(
      adminAdoptBlockedPayoutTransferResultAction("p1", {
        stripeTransferId: "tr_a",
        reason: REASON,
      }),
    ).resolves.toBe(denied);
    await expect(
      adminReleaseBlockedPayoutResultAction("p1", {
        reason: REASON,
        noLiveTransferConfirmed: true,
      }),
    ).resolves.toBe(denied);
    expect(authedServerFetch).not.toHaveBeenCalled();
  });

  it("refuses a release that was not confirmed, or has a short reason, without calling the API", async () => {
    await expect(
      adminReleaseBlockedPayoutResultAction("p1", {
        reason: REASON,
        noLiveTransferConfirmed: false,
      }),
    ).resolves.toMatchObject({ ok: false, error: expect.stringContaining("checked in Stripe") });
    await expect(
      adminReleaseBlockedPayoutResultAction("p1", {
        reason: "short",
        noLiveTransferConfirmed: true,
      }),
    ).resolves.toMatchObject({ ok: false, error: expect.stringContaining("at least 10") });
    await expect(
      adminAdoptBlockedPayoutTransferResultAction("p1", { stripeTransferId: " ", reason: REASON }),
    ).resolves.toMatchObject({ ok: false, error: "Enter the Stripe transfer ID." });
    await expect(
      adminAdoptBlockedPayoutTransferResultAction("p1", {
        stripeTransferId: "tr_a",
        reason: "short",
      }),
    ).resolves.toMatchObject({ ok: false, error: expect.stringContaining("at least 10") });
    expect(authedServerFetch).not.toHaveBeenCalled();
  });

  it("shows the API's own reason when Stripe's transfer is refused", async () => {
    authedServerFetch.mockResolvedValue(
      json(409, {
        error: "destination_mismatch",
        message: "That transfer went to a different Stripe account than this seller's.",
      }),
    );

    await expect(
      adminAdoptBlockedPayoutTransferResultAction("p1", {
        stripeTransferId: "tr_a",
        reason: REASON,
      }),
    ).resolves.toMatchObject({
      ok: false,
      status: 409,
      error: "That transfer went to a different Stripe account than this seller's.",
    });
  });

  it("explains a payout that changed under the staff member in fixed copy", async () => {
    authedServerFetch.mockResolvedValue(json(409, { error: "payout_state_changed" }));

    await expect(
      adminReleaseBlockedPayoutResultAction("p1", {
        reason: REASON,
        noLiveTransferConfirmed: true,
      }),
    ).resolves.toMatchObject({ ok: false, error: expect.stringContaining("changed while you") });
  });
});
