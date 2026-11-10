export { OutboxAlertMailer, type AlertMailerOptions } from "./alert-mailer.js";
export { EMAIL_DEFAULT_CURRENCY, formatMoneyMajor } from "./format-money.js";
export { emailProductFor } from "./email-product.js";
export {
  BUYER_DEFAULT_NO_CHARGES,
  buyerDefaultCopy,
  paymentReminderCopy,
  type BuyerDefaultAudience,
  type BuyerDefaultCopy,
  type BuyerDefaultOutcomeKey,
  type PaymentReminderCopy,
  type PaymentReminderHoldKey,
  type PaymentReminderStepKey,
} from "./buyer-default-copy.js";
export { renderEmail } from "./render.js";
export { emailAttachments, type EmailAttachment } from "./attachments.js";
export {
  MARKETING_OPT_OUT_EMAIL_TEMPLATES,
  OPTIONAL_EMAIL_TEMPLATES,
  isOptionalEmailTemplate,
  suppressionBlocksTemplate,
} from "./suppression-policy.js";
export {
  EMAIL_TEMPLATE_LABELS,
  describeEmailTemplate,
  type EmailTemplateDescription,
} from "./template-labels.js";
export { SNAPSHOT_DISCARDED_AFTER_SEND } from "./snapshot-retention.js";
export {
  ConsoleEmailService,
  PostmarkEmailService,
  bindEmailQueue,
  emailHash,
} from "./outbox-service.js";
export type { EmailQueue, EmailQueuePayload } from "./outbox-service.js";
export type {
  EmailCategory,
  EmailEnqueueInput,
  EmailSenderPayload,
  EmailStream,
  IEmailSender,
  IEmailService,
  ITransactionalEmailOutbox,
} from "./service.js";
export {
  RECIPIENT_RESOLUTION,
  templateNames,
  type RecipientResolution,
  type RenderedEmail,
  type TemplateName,
  type TemplateVarsByName,
} from "./types.js";
