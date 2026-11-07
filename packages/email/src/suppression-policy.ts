import type { EmailSuppressionReason } from "@auction/db/schema";
import type { TemplateName } from "./types.js";

/**
 * Mail the recipient can opt out of: product notifications that carry an unsubscribe link.
 * Everything not listed here is transactional (invoices, receipts, refunds, payouts, KYC and
 * compliance, security notices, account mail, lot-won payment prompts) and is never silenced by
 * an unsubscribe. A new template is therefore transactional until someone decides otherwise,
 * so a forgotten entry can never hide financial or legal mail.
 */
export const OPTIONAL_EMAIL_TEMPLATES = [
  "bid-outbid",
  "lot-ended-seller",
  "submission-approved",
  "submission-converted",
  "submission-rejected",
  "submission-draft-reminder",
  "submission-changes-requested",
  "consignment-agreement-reminder",
  "consignment-update",
  "shop-edition-available-notify",
  "shop-release-alert",
  "alert-confirm",
  "alert-digest",
] as const satisfies readonly TemplateName[];

const OPTIONAL_SET: ReadonlySet<string> = new Set(OPTIONAL_EMAIL_TEMPLATES);

export function isOptionalEmailTemplate(template: string): boolean {
  return OPTIONAL_SET.has(template);
}

/**
 * The narrow set a Zoho Campaigns unsubscribe silences: shop and sale alerts. Marketing itself is
 * sent from Campaigns, not through this outbox, so this is the only LAX-sent mail it can touch.
 * Anything not listed here (receipts, invoices, security and account mail, and the other optional
 * product notices) still goes out.
 */
export const MARKETING_OPT_OUT_EMAIL_TEMPLATES = [
  "shop-edition-available-notify",
  "shop-release-alert",
  "alert-confirm",
  "alert-digest",
] as const satisfies readonly (typeof OPTIONAL_EMAIL_TEMPLATES)[number][];

const MARKETING_OPT_OUT_SET: ReadonlySet<string> = new Set(MARKETING_OPT_OUT_EMAIL_TEMPLATES);

/**
 * Whether a suppression entry stops this template. An unsubscribe is the person's choice about
 * optional mail only, and a marketing unsubscribe is narrower still: alert and marketing mail only. Bounces, complaints and manual blocks mean the address cannot or must not
 * be mailed, so they stop everything.
 */
export function suppressionBlocksTemplate(
  reason: EmailSuppressionReason,
  template: string,
): boolean {
  if (reason === "unsubscribed_marketing") return MARKETING_OPT_OUT_SET.has(template);
  if (reason === "unsubscribe") return isOptionalEmailTemplate(template);
  return true;
}
