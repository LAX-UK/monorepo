import type { LaxBrandProduct } from "./brand-identity.js";
import { LAX_PRODUCT_NAMES } from "./legal-entity.js";

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

/** LAX Account lockup (mark with ACCOUNT descriptor) in `apps/web/public/email/`, 280px wide. */
export const EMAIL_ACCOUNT_LOCKUP_URL = `${EMAIL_SITE_URL}/email/lax-account-lockup.png`;
export const EMAIL_ACCOUNT_LOCKUP_URL_2X = `${EMAIL_SITE_URL}/email/lax-account-lockup@2x.png`;
/** Display size in email HTML; the source images are 280x78 and 560x156. */
export const EMAIL_ACCOUNT_LOCKUP_DISPLAY_WIDTH = 140;
export const EMAIL_ACCOUNT_LOCKUP_DISPLAY_HEIGHT = 39;
export const EMAIL_ACCOUNT_LOCKUP_ALT = "LAX Account";

export const EMAIL_LOGO_ALT = LAX_PRODUCT_NAMES.bid;

export type EmailProductLogo = {
  readonly url: string;
  readonly url2x: string;
  readonly displayWidth: number;
  readonly displayHeight: number;
  readonly alt: string;
};

/** Lockup PNGs share one source height (141px at 1x), so each product shows at the same height. */
const LOCKUP_DISPLAY_HEIGHT = 47;

function productLockup(file: string, sourceWidth: number, product: LaxBrandProduct) {
  return {
    url: `${EMAIL_SITE_URL}/email/${file}.png`,
    url2x: `${EMAIL_SITE_URL}/email/${file}@2x.png`,
    displayWidth: Math.round((sourceWidth * LOCKUP_DISPLAY_HEIGHT) / 141),
    displayHeight: LOCKUP_DISPLAY_HEIGHT,
    alt: LAX_PRODUCT_NAMES[product],
  } satisfies EmailProductLogo;
}

/** The lockup at the top of each product's email; mail from one product never shows another's. */
export const EMAIL_PRODUCT_LOGOS: Readonly<Record<LaxBrandProduct, EmailProductLogo>> = {
  bid: {
    url: EMAIL_LOGO_URL,
    url2x: EMAIL_LOGO_URL_2X,
    displayWidth: EMAIL_LOGO_DISPLAY_WIDTH,
    displayHeight: Math.round(
      (EMAIL_LOGO_SRC_HEIGHT * EMAIL_LOGO_DISPLAY_WIDTH) / EMAIL_LOGO_SRC_WIDTH,
    ),
    alt: EMAIL_LOGO_ALT,
  },
  shop: productLockup("lax-shop-lockup", 421, "shop"),
  art: productLockup("lax-art-lockup", 392, "art"),
  account: {
    url: EMAIL_ACCOUNT_LOCKUP_URL,
    url2x: EMAIL_ACCOUNT_LOCKUP_URL_2X,
    displayWidth: EMAIL_ACCOUNT_LOCKUP_DISPLAY_WIDTH,
    displayHeight: EMAIL_ACCOUNT_LOCKUP_DISPLAY_HEIGHT,
    alt: EMAIL_ACCOUNT_LOCKUP_ALT,
  },
};

/** Primary post-welcome / transactional CTA to the signed-in app. */
export const EMAIL_DASHBOARD_URL = `${EMAIL_SITE_URL}/home`;
