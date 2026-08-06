import { buildTrustedAuthOrigins } from "@auction/auth/server";
import type { Context } from "hono";

/** Allow audited SoF document previews to embed in the staff web app iframe. */
export function applyStaffPreviewFramingHeaders(
  c: Context,
  env: {
    WEB_ORIGIN: string;
    WEB_ORIGINS?: string[] | undefined;
    SSR_TRUSTED_ORIGINS?: string[] | undefined;
  },
): void {
  const ancestors = buildTrustedAuthOrigins({
    webOrigin: env.WEB_ORIGIN,
    webOrigins: env.WEB_ORIGINS,
    additionalOrigins: env.SSR_TRUSTED_ORIGINS,
  }).join(" ");
  c.res.headers.delete("X-Frame-Options");
  c.header("Content-Security-Policy", `frame-ancestors ${ancestors}`);
}
