import { SITE_NAME } from "./site.js";

export const EMAIL_SITE_URL = "https://lax.bid" as const;

/** Hosted PNG in `apps/web/public/email/` */
export const EMAIL_LOGO_URL = `${EMAIL_SITE_URL}/email/lax-logo.png` as const;

export const EMAIL_LOGO_SRC_WIDTH = 480;
export const EMAIL_LOGO_SRC_HEIGHT = 140;
/** Display width in email HTML (height scales) */
export const EMAIL_LOGO_DISPLAY_WIDTH = 160;

export const EMAIL_LOGO_ALT = `${SITE_NAME} — London Art Exchange` as const;
