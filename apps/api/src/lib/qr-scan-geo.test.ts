import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { readQrScanGeoFromHeaders } from "./qr-scan-geo.js";

describe("readQrScanGeoFromHeaders", () => {
  it("reads country from common CDN headers and ignores unknown markers", async () => {
    const app = new Hono();
    app.get("/test", (c) => {
      const geo = readQrScanGeoFromHeaders(c);
      return c.json(geo);
    });

    const res = await app.request("http://test/test", {
      headers: {
        "cf-ipcountry": "GB",
        "cf-region": "England",
        "cf-ipcity": "London",
      },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      country: "GB",
      region: "England",
      city: "London",
    });
  });

  it("returns null geo when headers are absent or masked", async () => {
    const app = new Hono();
    app.get("/test", (c) => c.json(readQrScanGeoFromHeaders(c)));

    const res = await app.request("http://test/test", {
      headers: { "cf-ipcountry": "XX" },
    });
    await expect(res.json()).resolves.toEqual({
      country: null,
      region: null,
      city: null,
    });
  });
});
