import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/art-catalogue.server", () => ({
  artCatalogueApiServerUrl: (path: string) => `https://shop-api.test${path}`,
}));

import { previewAlertStop, stopAlerts } from "./art-email-alerts.server";

const TOKEN = `${"e".repeat(60)}.${"f".repeat(43)}`;

afterEach(() => vi.unstubAllGlobals());

function respond(status: number, body: unknown = {}) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("lax.art email alert links", () => {
  it("reads the preview with the token alone", async () => {
    const fetchMock = respond(200, { maskedEmail: "c•••@example.com", active: true });
    expect(await previewAlertStop(TOKEN)).toEqual({
      status: "ok",
      preview: { maskedEmail: "c•••@example.com", active: true },
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `https://shop-api.test/v1/email-alerts/unsubscribe?token=${encodeURIComponent(TOKEN)}`,
    );
  });

  it("calls a malformed token invalid without asking the API", async () => {
    const fetchMock = respond(200);
    expect(await previewAlertStop("short")).toEqual({ status: "invalid" });
    expect(await stopAlerts("short")).toEqual({ status: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps the API's answers: unknown token, outage, success", async () => {
    respond(404);
    expect(await previewAlertStop(TOKEN)).toEqual({ status: "invalid" });
    expect(await stopAlerts(TOKEN)).toEqual({ status: "invalid" });
    respond(503);
    expect(await previewAlertStop(TOKEN)).toEqual({ status: "failed" });
    expect(await stopAlerts(TOKEN)).toEqual({ status: "failed" });
    const fetchMock = respond(200, { subscribed: false });
    expect(await stopAlerts(TOKEN)).toEqual({ status: "ok" });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ token: TOKEN }),
    });
  });

  it("reports a network failure as failed, never as invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    expect(await previewAlertStop(TOKEN)).toEqual({ status: "failed" });
    expect(await stopAlerts(TOKEN)).toEqual({ status: "failed" });
  });
});
