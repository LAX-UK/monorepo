import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createQrRoutes } from "./qr.js";

describe("QR redirect routes", () => {
  it("redirects with a noindex header and records scans asynchronously", async () => {
    const enqueueScan = vi.fn().mockResolvedValue(undefined);
    const app = new Hono();
    app.route(
      "/q",
      createQrRoutes({
        qrCodeService: {
          resolve: vi.fn().mockResolvedValue({
            ok: true,
            qrCodeId: "qr_1",
            destinationUrl: "https://example.test/sales/sale/id",
          }),
          enqueueScan,
        },
      } as never),
    );

    const res = await app.request("/q/Abc12345", {
      headers: { "user-agent": "Mozilla/5.0", "x-forwarded-for": "203.0.113.42" },
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.test/sales/sale/id");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
    expect(enqueueScan).toHaveBeenCalledWith(
      expect.objectContaining({ qrCodeId: "qr_1", ip: "203.0.113.42" }),
    );
  });

  it("returns 410 for disabled or expired codes without redirecting", async () => {
    const app = new Hono();
    app.route(
      "/q",
      createQrRoutes({
        qrCodeService: {
          resolve: vi.fn().mockResolvedValue({ ok: false, status: 410, reason: "inactive" }),
          enqueueScan: vi.fn(),
        },
      } as never),
    );

    const res = await app.request("/q/Abc12345");

    expect(res.status).toBe(410);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });
});
