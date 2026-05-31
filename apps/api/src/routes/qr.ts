import { qrShortCodeParamSchema } from "@auction/validators";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { zValidator } from "../lib/z-validator.js";

const shortCodeSegment = ":shortCode{[0-9A-Za-z]{6,12}}";

export function createQrRoutes(container: Container) {
  const r = new Hono();

  r.get(`/${shortCodeSegment}`, zValidator("param", qrShortCodeParamSchema), async (c) => {
    const { shortCode } = c.req.valid("param");
    const resolved = await container.qrCodeService.resolve(shortCode);
    if (!resolved.ok) {
      c.header("X-Robots-Tag", "noindex");
      const status = resolved.status;
      return c.text(
        status === 410 ? "This QR code is no longer active." : "QR code not found.",
        status,
      );
    }

    void container.qrCodeService.enqueueScan({
      qrCodeId: resolved.qrCodeId,
      ip:
        c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? null,
      userAgent: c.req.header("user-agent") ?? null,
      referrer: c.req.header("referer") ?? c.req.header("referrer") ?? null,
      requestId: c.req.header("x-request-id") ?? null,
    });

    c.header("X-Robots-Tag", "noindex");
    return c.redirect(resolved.destinationUrl, 302);
  });

  return r;
}
