export { renderEmail } from "./render.js";
export { ConsoleEmailService, PostmarkEmailService, emailHash } from "./outbox-service.js";
export type {
  EmailCategory,
  EmailEnqueueInput,
  EmailSenderPayload,
  EmailStream,
  IEmailSender,
  IEmailService,
} from "./service.js";
export {
  RECIPIENT_RESOLUTION,
  templateNames,
  type RecipientResolution,
  type RenderedEmail,
  type TemplateName,
  type TemplateVarsByName,
} from "./types.js";
