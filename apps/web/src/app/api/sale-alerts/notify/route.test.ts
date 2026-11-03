// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const forward = vi.fn();
vi.mock("@/lib/data/http/sale-alerts.server", () => ({
  forwardVisitorAlertSignup: (input: unknown) => forward(input),
}));

const { POST } = await import("./route");

function post(fields: Record<string, string>) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.set(key, value);
  return POST(new Request("https://lax.bid/api/sale-alerts/notify", { method: "POST", body }));
}

describe("POST /api/sale-alerts/notify", () => {
  beforeEach(() => forward.mockReset());

  it("sends the visitor back to the alerts band with the outcome", async () => {
    forward.mockResolvedValue(new Response(null, { status: 200 }));
    const res = await post({ email: "Ada@Example.com", source: "web_home_alerts" });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://lax.bid/?alerts=submitted#alerts");
    expect(forward).toHaveBeenCalledWith({ email: "ada@example.com", source: "web_home_alerts" });
  });

  it("does not call the API for an invalid address", async () => {
    const res = await post({ email: "nope" });
    expect(res.headers.get("location")).toBe("https://lax.bid/?alerts=invalid#alerts");
    expect(forward).not.toHaveBeenCalled();
  });

  it("reports a rate limit and a failure differently", async () => {
    forward.mockResolvedValueOnce(new Response(null, { status: 429 }));
    expect((await post({ email: "a@b.co" })).headers.get("location")).toContain("alerts=limited");
    forward.mockResolvedValueOnce(new Response(null, { status: 500 }));
    expect((await post({ email: "a@b.co" })).headers.get("location")).toContain("alerts=failed");
  });

  it("treats an unknown form source as the cover", async () => {
    forward.mockResolvedValue(new Response(null, { status: 200 }));
    await post({ email: "a@b.co", source: "evil" });
    expect(forward).toHaveBeenCalledWith({ email: "a@b.co", source: "web_home_cover" });
  });
});
