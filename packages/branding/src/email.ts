import { SITE_NAME } from "./site.js";

/** Last resort for local scripts/tests — never production (avoids wrong logos in staging/test). */
const DEV_FALLBACK_EMAIL_SITE_URL = "http://localhost:3000";

function resolveEmailSiteUrl(): string {
  const fromEnv =
    typeof process !== "undefined" && process.env
      ? (process.env.EMAIL_ASSETS_BASE_URL ??
        process.env.NEXT_PUBLIC_SITE_URL ??
        process.env.WEB_ORIGIN)
      : undefined;
  const trimmed = typeof fromEnv === "string" ? fromEnv.trim() : "";
  if (!trimmed) return DEV_FALLBACK_EMAIL_SITE_URL;
  return trimmed.replace(/\/$/, "");
}

/** Public web origin used for hosted email assets and primary CTAs (logo, dashboard link). */
export const EMAIL_SITE_URL = resolveEmailSiteUrl();

/** Hosted PNG in `apps/web/public/email/` */
export const EMAIL_LOGO_URL = `${EMAIL_SITE_URL}/email/lax-logo.png`;

/** Retina asset in `apps/web/public/email/` — used in `srcSet` where supported. */
export const EMAIL_LOGO_URL_2X = `${EMAIL_SITE_URL}/email/lax-logo@2x.png`;

export const EMAIL_LOGO_SRC_WIDTH = 480;
export const EMAIL_LOGO_SRC_HEIGHT = 140;
/** Display width in email HTML (height scales) */
export const EMAIL_LOGO_DISPLAY_WIDTH = 160;

export const EMAIL_LOGO_ALT = `${SITE_NAME} — London Art Exchange` as const;

/** Primary post-welcome / transactional CTA to the signed-in app. */
export const EMAIL_DASHBOARD_URL = `${EMAIL_SITE_URL}/dashboard`;
