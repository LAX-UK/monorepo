import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());
const revalidate = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: revalidate }));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/data/http/authed-server-fetch", () => ({
  authedServerFetch: (...args: unknown[]) => fetchMock(...args),
}));

const { acceptBidderReofferAction, declineBidderReofferAction } = await import("./bidder-reoffer");

const ID = "11111111-1111-4111-8111-111111111111";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("acceptBidderReofferAction", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    revalidate.mockReset();
  });

  it("posts the ticked terms and nothing else, and returns the lot to land on", async () => {
    fetchMock.mockResolvedValue(json({ data: { reofferId: ID, lotId: "lot-9" } }));
    expect(await acceptBidderReofferAction(ID, true)).toEqual({
      ok: true,
      data: { lotId: "lot-9" },
    });
    const [path, init] = fetchMock.mock.calls[0] as [string, { method: string; body: string }];
    expect(path).toBe(`/legal-entities/reoffers/${ID}/accept`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ termsAccepted: true });
    expect(revalidate).toHaveBeenCalledWith(`/bids/offers/${ID}`);
    expect(revalidate).toHaveBeenCalledWith("/purchases");
    expect(revalidate).toHaveBeenCalledWith("/bids");
  });

  it("does not call the API without the terms ticked", async () => {
    expect(await acceptBidderReofferAction(ID, false)).toMatchObject({
      ok: false,
      error: "Tick the box to accept.",
    });
    expect(await acceptBidderReofferAction("not-an-id", true)).toMatchObject({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("carries the refusal's code and words, and changes nothing on screen", async () => {
    fetchMock.mockResolvedValue(json({ error: "offer_window_ended", message: "x" }, 409));
    expect(await acceptBidderReofferAction(ID, true)).toEqual({
      ok: false,
      error: "This offer has ended. It can no longer be accepted.",
      status: 409,
      errorCode: "offer_window_ended",
    });
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("says an account that cannot accept was refused, in words", async () => {
    fetchMock.mockResolvedValue(json({ error: "bidder_unavailable", message: "x" }, 409));
    expect(await acceptBidderReofferAction(ID, true)).toMatchObject({
      ok: false,
      errorCode: "bidder_unavailable",
      error: expect.stringContaining("Contact us"),
    });
  });

  it("says it is on our side when the API cannot be reached", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    expect(await acceptBidderReofferAction(ID, true)).toMatchObject({
      ok: false,
      status: 503,
      error: expect.stringContaining("Nothing was changed"),
    });
  });
});

describe("declineBidderReofferAction", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    revalidate.mockReset();
  });

  it("posts the optional reason and refreshes the pages that show the offer", async () => {
    fetchMock.mockResolvedValue(json({ data: { reofferId: ID } }));
    expect(await declineBidderReofferAction(ID, { reason: "Over budget" })).toEqual({ ok: true });
    const [path, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(path).toBe(`/legal-entities/reoffers/${ID}/decline`);
    expect(JSON.parse(init.body)).toEqual({ reason: "Over budget" });
    expect(revalidate).toHaveBeenCalledWith(`/bids/offers/${ID}`);
  });

  it("refuses a reason that is too long without calling the API", async () => {
    expect(await declineBidderReofferAction(ID, { reason: "x".repeat(501) })).toMatchObject({
      ok: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
