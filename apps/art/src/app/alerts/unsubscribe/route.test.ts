import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const stopAlerts = vi.fn();
vi.mock("@/lib/alerts/art-email-alerts.server", () => ({
  stopAlerts: (...args: unknown[]) => stopAlerts(...args),
}));

import { GET, POST } from "./route";

beforeEach(() => stopAlerts.mockReset());

const url = "https://lax.art/alerts/unsubscribe?token=abc.def";

describe("lax.art /alerts/unsubscribe", () => {
  it("answers a GET with a 303 to the stop page and changes nothing", () => {
    const res = GET(new NextRequest(url));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://lax.art/alerts/stop?token=abc.def");
    expect(stopAlerts).not.toHaveBeenCalled();
  });

  it("stops the emails on a mail app's one-click POST and answers in plain text", async () => {
    stopAlerts.mockResolvedValue({ status: "ok" });
    const res = await POST(
      new NextRequest(url, {
        method: "POST",
        body: "List-Unsubscribe=One-Click",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(stopAlerts).toHaveBeenCalledWith("abc.def");
  });

  it("stops the emails from the page's button and sends the person back to the page", async () => {
    stopAlerts.mockResolvedValue({ status: "ok" });
    const res = await POST(
      new NextRequest(url, {
        method: "POST",
        body: "from=page",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://lax.art/alerts/stop?token=abc.def&result=stopped",
    );
  });

  it("tells the page when the link does not work or the service is down", async () => {
    stopAlerts.mockResolvedValueOnce({ status: "invalid" });
    const invalid = await POST(
      new NextRequest(url, {
        method: "POST",
        body: "from=page",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }),
    );
    expect(invalid.headers.get("location")).toContain("result=invalid");
    stopAlerts.mockResolvedValueOnce({ status: "failed" });
    const failed = await POST(
      new NextRequest(url, {
        method: "POST",
        body: "from=page",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      }),
    );
    expect(failed.headers.get("location")).toContain("result=failed");
  });

  it("answers a mail app 404 for a bad link and 503 when it cannot be reached", async () => {
    stopAlerts.mockResolvedValueOnce({ status: "invalid" });
    expect((await POST(new NextRequest(url, { method: "POST" }))).status).toBe(404);
    stopAlerts.mockResolvedValueOnce({ status: "failed" });
    expect((await POST(new NextRequest(url, { method: "POST" }))).status).toBe(503);
  });
});
