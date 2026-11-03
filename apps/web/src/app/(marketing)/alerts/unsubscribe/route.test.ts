import { beforeEach, describe, expect, it, vi } from "vitest";

const stopAlertsOneClick = vi.fn();
vi.mock("@/lib/data/http/alerts.server", () => ({
  stopAlertsOneClick: (...args: unknown[]) => stopAlertsOneClick(...args),
}));

import { GET, POST } from "./route";

beforeEach(() => stopAlertsOneClick.mockReset());

describe("/alerts/unsubscribe", () => {
  it("answers a GET with a 303 to the stop page and changes nothing", () => {
    const res = GET(new Request("https://lax.bid/alerts/unsubscribe?t=abc.def"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://lax.bid/alerts/stop?t=abc.def");
    expect(stopAlertsOneClick).not.toHaveBeenCalled();
  });

  it("stops every topic on a one-click POST and answers 200 in plain text", async () => {
    stopAlertsOneClick.mockResolvedValue(true);
    const res = await POST(
      new Request("https://lax.bid/alerts/unsubscribe?t=abc.def", {
        method: "POST",
        body: "List-Unsubscribe=One-Click",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(stopAlertsOneClick).toHaveBeenCalledWith("abc.def");
  });

  it("answers 400 for a link that does not work, or none", async () => {
    stopAlertsOneClick.mockResolvedValue(false);
    const bad = await POST(
      new Request("https://lax.bid/alerts/unsubscribe?t=bad", { method: "POST" }),
    );
    expect(bad.status).toBe(400);
    const none = await POST(new Request("https://lax.bid/alerts/unsubscribe", { method: "POST" }));
    expect(none.status).toBe(400);
  });
});
