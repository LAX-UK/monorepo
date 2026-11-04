/** The secret local and test stacks sign alert links with. Never usable in production. */
export const DEV_ALERT_LINK_SECRET = "dev-alert-link-secret-not-for-production";

const MIN_PRODUCTION_SECRET_LENGTH = 32;

/** A signing secret production may use: long enough, and not the development default. */
export function isUsableAlertLinkSecret(secret: string): boolean {
  return secret.length >= MIN_PRODUCTION_SECRET_LENGTH && secret !== DEV_ALERT_LINK_SECRET;
}
