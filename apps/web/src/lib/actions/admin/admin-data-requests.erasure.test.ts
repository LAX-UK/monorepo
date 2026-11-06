import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());
const denyMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/auth/assert-admin-action-capability", () => ({
  denyUnlessAdminCapability: (...args: unknown[]) => denyMock(...args),
}));
vi.mock("@/lib/data/http/authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => fetchMock(...args),
}));

const { eraseDataRequestEnquiriesAction } = await import("./admin-data-requests");

const EMAIL = "margaret.osei@outlook.co.uk";
const INPUT = { email: EMAIL, confirmation: EMAIL, reason: "Asked to be forgotten" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("eraseDataRequestEnquiriesAction", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    denyMock.mockReset().mockResolvedValue(null);
  });

  it("checks data_requests.manage before anything is sent", async () => {
    denyMock.mockResolvedValue({ ok: false, error: "no", status: 403 });
    const result = await eraseDataRequestEnquiriesAction("DR-0012", INPUT);
    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the trimmed body and returns the counts", async () => {
    fetchMock.mockResolvedValue(
      json({ data: { enquiries: 2, notes: 1, attachments: 0, held: 1 } }),
    );
    const result = await eraseDataRequestEnquiriesAction("DR-0012", {
      ...INPUT,
      reason: "  Asked to be forgotten ",
    });
    expect(result).toEqual({ ok: true, data: { enquiries: 2, notes: 1, attachments: 0, held: 1 } });
    const [path, init] = fetchMock.mock.calls[0] as [string, { method: string; body: string }];
    expect(path).toBe("/admin/data-requests/enquiry-erasure");
    expect(JSON.parse(init.body)).toEqual(INPUT);
  });

  it("refuses a mismatched address or short reason without calling the API", async () => {
    expect(
      (await eraseDataRequestEnquiriesAction("DR-0012", { ...INPUT, confirmation: "x@y.com" })).ok,
    ).toBe(false);
    expect((await eraseDataRequestEnquiriesAction("DR-0012", { ...INPUT, reason: "no" })).ok).toBe(
      false,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps the API's refusals and outages to plain sentences", async () => {
    fetchMock.mockResolvedValue(json({ error: "confirmation_mismatch" }, 422));
    expect(await eraseDataRequestEnquiriesAction("DR-0012", INPUT)).toMatchObject({
      ok: false,
      error: "The email address you typed doesn't match.",
      errorCode: "confirmation_mismatch",
    });
    fetchMock.mockResolvedValue(json({}, 403));
    expect(await eraseDataRequestEnquiriesAction("DR-0012", INPUT)).toMatchObject({
      ok: false,
      status: 403,
    });
    fetchMock.mockRejectedValue(new Error("down"));
    expect(await eraseDataRequestEnquiriesAction("DR-0012", INPUT)).toMatchObject({
      ok: false,
      status: 503,
    });
  });
});
