import { SITE_NAME } from "./site.js";

/** Centralised transactional email subjects (templates should import from here). */
export const emailSubjects = {
  passwordChanged: `Your ${SITE_NAME} password was changed`,
  twoFactorEnabled: `Two-factor authentication was turned on — ${SITE_NAME}`,
  twoFactorDisabled: `Two-factor authentication was turned off — ${SITE_NAME}`,
  newDeviceLogin: `New sign-in to your ${SITE_NAME} account`,
  passwordChangedElsewhere: `Your ${SITE_NAME} password was reset from another session`,
} as const;
