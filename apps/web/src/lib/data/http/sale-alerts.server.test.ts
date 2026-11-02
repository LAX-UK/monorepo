import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/http/hc-server", () => ({ getServerApiBase: () => "http://127.0.0.1:3001" }));
vi.mock("@/lib/data/http/server-request-headers", () => ({
  deriveSsrOrigin: async () => "https://lax.bid",
}));
vi.mock("@/lib/data/http/authed-fetch.server", () => ({ authedServerFetch: vi.fn() }));

const { confirmVisitorAlert, forwardVisitorAlertSignup, getVisitorAlertUnsubscribePreview } =
  await import("./sale-alerts.server");

describe("sale alerts server calls", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("posts a sign-up to the API with the public origin", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null));
    await forwardVisitorAlertSignup({ email: "a@b.co", source: "web_home_alerts" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:3001/sale-alerts/subscribe",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://lax.bid" },
      }),
    );
  });

  it("reads the confirmation outcome, and separates a bad link from an outage", async () => {
    const reply = (body: unknown, status = 200) =>
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json(body, { status }));
    reply({ ok: true, outcome: "confirmed" });
    expect(await confirmVisitorAlert("t")).toBe("confirmed");
    reply({ ok: true, outcome: "expired" });
    expect(await confirmVisitorAlert("t")).toBe("expired");
    reply({ ok: true, outcome: "invalid" });
    expect(await confirmVisitorAlert("t")).toBe("invalid");
    reply({ error: "bad" }, 400);
    expect(await confirmVisitorAlert("t")).toBe("invalid");
    reply({}, 502);
    expect(await confirmVisitorAlert("t")).toBe("failed");
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("down"));
    expect(await confirmVisitorAlert("t")).toBe("failed");
  });

  it("previews an unsubscribe link and returns null for a bad one", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ ok: true, data: { email: "a@b.co" } }),
    );
    expect(await getVisitorAlertUnsubscribePreview("t")).toEqual({ email: "a@b.co" });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({}, { status: 400 }));
    expect(await getVisitorAlertUnsubscribePreview("t")).toBeNull();
  });
});
