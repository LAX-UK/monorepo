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
const INPUT = { confirmation: EMAIL, reason: "Asked to be forgotten" };
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
    expect(path).toBe("/admin/data-requests/DR-0012/enquiry-erasure");
    expect(JSON.parse(init.body)).toEqual(INPUT);
  });

  it("sends the reference and what was typed, never an email address from the browser", async () => {
    fetchMock.mockResolvedValue(
      json({ data: { enquiries: 0, notes: 0, attachments: 0, held: 0 } }),
    );
    await eraseDataRequestEnquiriesAction("DR-0012", {
      ...INPUT,
      email: "someone@else.com",
    } as never);
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(Object.keys(JSON.parse(init.body)).sort()).toEqual(["confirmation", "reason"]);
  });

  it("leaves comparing the confirmation to the server, which holds the address", async () => {
    fetchMock.mockResolvedValue(json({ error: "confirmation_mismatch" }, 422));
    const result = await eraseDataRequestEnquiriesAction("DR-0012", {
      ...INPUT,
      confirmation: "x@y.com",
    });
    expect(result).toMatchObject({ ok: false, errorCode: "confirmation_mismatch" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("explains a request that is not in progress", async () => {
    fetchMock.mockResolvedValue(json({ error: "erasure_not_allowed" }, 409));
    expect(await eraseDataRequestEnquiriesAction("DL-7F3C1A", INPUT)).toMatchObject({
      ok: false,
      status: 409,
      error: "Enquiries can only be erased while the request is in progress.",
    });
  });

  it("refuses a short reason without calling the API", async () => {
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
