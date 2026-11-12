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

const { answerSellerReofferAction } = await import("./seller-reoffer");

const ID = "11111111-1111-4111-8111-111111111111";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("answerSellerReofferAction", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    revalidate.mockReset();
  });

  it("posts the answer to the account's own request and refreshes the pages that show it", async () => {
    fetchMock.mockResolvedValue(json({ data: { consentStatus: "given" } }));
    expect(await answerSellerReofferAction(ID, { answer: "given" })).toEqual({
      ok: true,
      data: undefined,
    });
    const [path, init] = fetchMock.mock.calls[0] as [string, { method: string; body: string }];
    expect(path).toBe(`/legal-entities/reoffer-requests/${ID}/answer`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ answer: "given" });
    expect(revalidate).toHaveBeenCalledWith(`/selling/payouts/offers/${ID}`);
    expect(revalidate).toHaveBeenCalledWith("/home");
  });

  it("sends what a refusing seller would rather happen", async () => {
    fetchMock.mockResolvedValue(json({ data: {} }));
    await answerSellerReofferAction(ID, { answer: "refused", declinePreference: "talk_to_us" });
    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(init.body)).toEqual({ answer: "refused", declinePreference: "talk_to_us" });
  });

  it("refuses an answer that is not one without calling the API", async () => {
    expect(await answerSellerReofferAction(ID, { answer: "refused" })).toMatchObject({
      ok: false,
      error: "Choose what you'd like us to do.",
    });
    expect(await answerSellerReofferAction("nope", { answer: "given" })).toMatchObject({
      ok: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["forbidden", 403, "Your role in this account can't answer this request."],
    ["consent_already_answered", 409, "This request has already been answered."],
    [
      "consent_window_ended",
      409,
      "This request has closed. Please contact us and we'll take it from there.",
    ],
  ])("tells the seller why %s did not go through", async (error, status, message) => {
    fetchMock.mockResolvedValue(json({ error, message: "api words" }, status));
    expect(await answerSellerReofferAction(ID, { answer: "given" })).toMatchObject({
      ok: false,
      error: message,
      errorCode: error,
    });
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("says nothing was changed when the API cannot be reached or answers unexpectedly", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    expect(await answerSellerReofferAction(ID, { answer: "given" })).toMatchObject({
      ok: false,
      status: 503,
      error: expect.stringContaining("Nothing was changed"),
    });
    fetchMock.mockResolvedValue(json({ error: "something_new" }, 500));
    expect(await answerSellerReofferAction(ID, { answer: "given" })).toMatchObject({
      ok: false,
      error: expect.stringContaining("Nothing was changed"),
    });
  });
});
