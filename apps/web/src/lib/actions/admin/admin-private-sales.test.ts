import { dealRecord } from "@/components/admin/private-sales/deal.fixture";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());
const denyMock = vi.hoisted(() => vi.fn());
const stepUpMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  denyUnlessAdminCapability: (...args: unknown[]) => denyMock(...args),
}));
vi.mock("@/lib/auth/step-up/staff-step-up.server", () => ({
  isStaffStepUpResponse: (...args: unknown[]) => stepUpMock(...args),
}));
vi.mock("@/lib/data/http/authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => fetchMock(...args),
}));

const { convertEnquiryAction, dealMoveAction, nameDealBuyerAction, updateDealTermsAction } =
  await import("./admin-private-sales");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Sent = {
  path: string;
  init: { method: string; headers: Record<string, string>; body?: string };
};
const sent = (): Sent => {
  const call = fetchMock.mock.calls[0] as [string, Sent["init"]];
  return { path: call[0], init: call[1] };
};

beforeEach(() => {
  fetchMock.mockReset();
  denyMock.mockReset().mockResolvedValue(null);
  stepUpMock.mockReset().mockResolvedValue(false);
});

describe("dealMoveAction", () => {
  it("makes the move on the deal and returns the fresh record", async () => {
    fetchMock.mockResolvedValue(json({ data: dealRecord({ stage: "agreed" }) }));
    const result = await dealMoveAction("PS-0012", "agree", {});
    expect(result.ok && result.data?.stage).toBe("agreed");
    expect(sent().path).toBe("/admin/private-sales/PS-0012/actions/agree");
    expect(sent().init.method).toBe("POST");
  });

  it("sends the dialog's idempotency key with a move that takes money, and not with one that does not", async () => {
    fetchMock.mockImplementation(async () => json({ data: dealRecord() }));
    await dealMoveAction("PS-0012", "issue_invoice", { idempotencyKey: "key-for-this-dialog" });
    expect(sent().init.headers["Idempotency-Key"]).toBe("key-for-this-dialog");
    fetchMock.mockClear();
    await dealMoveAction("PS-0012", "agree", { idempotencyKey: "key-for-this-dialog" });
    expect(sent().init.headers["Idempotency-Key"]).toBeUndefined();
  });

  it("makes a key when the dialog supplied none or a poor one", async () => {
    fetchMock.mockImplementation(async () => json({ data: dealRecord() }));
    await dealMoveAction("PS-0012", "refund", { idempotencyKey: "x" });
    expect(sent().init.headers["Idempotency-Key"]).toMatch(/.{8,}/);
  });

  it("keeps every reason a move is blocked for the screen to show", async () => {
    const blockers = [
      { code: "kyc_not_clear", message: "The buyer has not verified their identity yet." },
    ];
    fetchMock.mockResolvedValue(json({ error: "blocked", blockers }, 422));
    const result = await dealMoveAction("PS-0012", "agree", {});
    expect(result).toMatchObject({
      ok: false,
      errorCode: "blocked",
      status: 422,
      meta: { blockers },
    });
  });

  it("turns a stale sign-in into the step-up code", async () => {
    stepUpMock.mockResolvedValue(true);
    fetchMock.mockResolvedValue(json({ code: "step_up_required" }, 403));
    expect(await dealMoveAction("PS-0012", "refund", {})).toMatchObject({
      ok: false,
      errorCode: "step_up_required",
    });
  });

  it("does not call the API for someone without the capability, or for a bad reference", async () => {
    denyMock.mockResolvedValue({ ok: false, error: "no", status: 403 });
    expect(await dealMoveAction("PS-0012", "agree", {})).toMatchObject({ ok: false, status: 403 });
    denyMock.mockResolvedValue(null);
    expect(await dealMoveAction("nope", "agree", {})).toMatchObject({ ok: false, status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks the right capability for each move", async () => {
    fetchMock.mockImplementation(async () => json({ data: dealRecord() }));
    await dealMoveAction("PS-0012", "issue_invoice", {});
    await dealMoveAction("PS-0012", "release", {});
    await dealMoveAction("PS-0012", "cancel", { reason: "x" });
    const required = denyMock.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(required[0]).toContain("finance.platform.write");
    expect(required[1]).toContain("operations.fulfilment");
    expect(required[2]).toContain("private_sale.manage");
  });

  it("says nothing was changed when the API does not answer", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    expect(await dealMoveAction("PS-0012", "agree", {})).toMatchObject({
      ok: false,
      status: 503,
      error: expect.stringContaining("Nothing was changed"),
    });
  });
});

describe("updateDealTermsAction", () => {
  it("sends the version and terms, and rejects an empty change", async () => {
    fetchMock.mockImplementation(async () => json({ data: dealRecord() }));
    expect(
      (await updateDealTermsAction("PS-0012", { version: 4, terms: { costsMinor: 100 } })).ok,
    ).toBe(true);
    expect(sent().init.method).toBe("PATCH");
    expect(JSON.parse(sent().init.body ?? "{}")).toEqual({
      version: 4,
      terms: { costsMinor: 100 },
    });
    fetchMock.mockClear();
    expect(await updateDealTermsAction("PS-0012", { version: 4, terms: {} })).toMatchObject({
      ok: false,
      status: 400,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a stale version with its code", async () => {
    fetchMock.mockResolvedValue(json({ error: "stale_version", currentVersion: 6 }, 409));
    expect(
      await updateDealTermsAction("PS-0012", { version: 4, terms: { costsMinor: 1 } }),
    ).toMatchObject({
      ok: false,
      errorCode: "stale_version",
      status: 409,
    });
  });
});

describe("nameDealBuyerAction", () => {
  it("names the buyer against a version", async () => {
    fetchMock.mockImplementation(async () => json({ data: dealRecord() }));
    await nameDealBuyerAction("PS-0012", { version: 4, buyerUserId: "u-1" });
    expect(sent().path).toBe("/admin/private-sales/PS-0012/buyer");
    expect(sent().init.method).toBe("PUT");
  });
});

describe("convertEnquiryAction", () => {
  it("returns the new deal's reference", async () => {
    fetchMock.mockResolvedValue(json({ data: { reference: "PS-0012" } }, 201));
    const result = await convertEnquiryAction("E-1042", { workReference: "C-1042" });
    expect(result).toEqual({ ok: true, data: { reference: "PS-0012" } });
    expect(sent().path).toBe("/admin/enquiries/E-1042/convert");
  });

  it("explains a refusal in words", async () => {
    fetchMock.mockResolvedValue(json({ error: "account_required" }, 422));
    expect(await convertEnquiryAction("E-1042", {})).toMatchObject({
      ok: false,
      error: expect.stringContaining("no LAX account yet"),
    });
  });
});
