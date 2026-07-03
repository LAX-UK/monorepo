import type { AdminTemplateVars } from "./templates/types/admin.js";
import { adminTemplates } from "./templates/types/admin.js";
import type { AuthTemplateVars } from "./templates/types/auth.js";
import { authTemplates } from "./templates/types/auth.js";
import type { BiddingTemplateVars } from "./templates/types/bidding.js";
import { biddingTemplates } from "./templates/types/bidding.js";
import type { ComplianceTemplateVars } from "./templates/types/compliance.js";
import { complianceTemplates } from "./templates/types/compliance.js";
import type { InviteTemplateVars } from "./templates/types/invite.js";
import { inviteTemplates } from "./templates/types/invite.js";
import type { LegalEntityTemplateVars } from "./templates/types/legal-entity.js";
import { legalEntityTemplates } from "./templates/types/legal-entity.js";
import type { PaymentTemplateVars } from "./templates/types/payment.js";
import { paymentTemplates } from "./templates/types/payment.js";
import type { PayoutTemplateVars } from "./templates/types/payout.js";
import { payoutTemplates } from "./templates/types/payout.js";
import type { RecipientResolution, RenderedEmail } from "./templates/types/shared.js";
import type { SubmissionTemplateVars } from "./templates/types/submission.js";
import { submissionTemplates } from "./templates/types/submission.js";

export type { RecipientResolution, RenderedEmail };

export const templateNames = [
  ...authTemplates.names,
  ...inviteTemplates.names,
  ...biddingTemplates.names,
  ...paymentTemplates.names,
  ...payoutTemplates.names,
  ...legalEntityTemplates.names,
  ...submissionTemplates.names,
  ...complianceTemplates.names,
  ...adminTemplates.names,
] as const;

export type TemplateName = (typeof templateNames)[number];

export type TemplateVarsByName = AuthTemplateVars &
  InviteTemplateVars &
  BiddingTemplateVars &
  PaymentTemplateVars &
  PayoutTemplateVars &
  LegalEntityTemplateVars &
  SubmissionTemplateVars &
  ComplianceTemplateVars &
  AdminTemplateVars;

export const RECIPIENT_RESOLUTION: Record<TemplateName, RecipientResolution> = {
  ...authTemplates.recipientResolution,
  ...inviteTemplates.recipientResolution,
  ...biddingTemplates.recipientResolution,
  ...paymentTemplates.recipientResolution,
  ...payoutTemplates.recipientResolution,
  ...legalEntityTemplates.recipientResolution,
  ...submissionTemplates.recipientResolution,
  ...complianceTemplates.recipientResolution,
  ...adminTemplates.recipientResolution,
};
