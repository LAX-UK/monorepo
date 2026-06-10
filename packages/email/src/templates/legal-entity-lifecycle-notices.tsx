import { Button } from "../components/Button.js";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const legalEntitySubmittedAdminSubject = (
  vars: TemplateVarsByName["legal-entity-submitted-admin-notice"],
) => `Organisation submitted for review: ${vars.entityName}`;

export function LegalEntitySubmittedAdminNoticeEmail(
  vars: TemplateVarsByName["legal-entity-submitted-admin-notice"],
) {
  return (
    <Layout
      category="alert"
      eyebrow="Organisation onboarding"
      preview={`${vars.entityName} submitted for review`}
      title="New organisation submission"
    >
      <TextBlock>
        <strong>{vars.entityName}</strong> has completed onboarding and is ready for KYB review.
      </TextBlock>
      <Button href={vars.adminOnboardingUrl}>Open onboarding queue</Button>
      <HelpBlock email={vars.supportContactEmail} />
    </Layout>
  );
}

export const legalEntityApprovedSubject = (
  vars: TemplateVarsByName["legal-entity-approved-notice"],
) => `${vars.entityName} has been approved on LAX`;

export function LegalEntityApprovedNoticeEmail(
  vars: TemplateVarsByName["legal-entity-approved-notice"],
) {
  return (
    <Layout
      category="alert"
      eyebrow="Organisation approved"
      preview={`${vars.entityName} approved`}
      title="Organisation approved"
    >
      <TextBlock>Hi {vars.recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        <strong>{vars.entityName}</strong> has been approved. Complete payout setup to start
        consigning and receiving payouts.
      </TextBlock>
      <Button href={vars.connectUrl}>Finish payout setup</Button>
      <HelpBlock email={vars.supportContactEmail} />
    </Layout>
  );
}

export const legalEntityRejectedSubject = (
  vars: TemplateVarsByName["legal-entity-rejected-notice"],
) => `Update on ${vars.entityName} verification`;

export function LegalEntityRejectedNoticeEmail(
  vars: TemplateVarsByName["legal-entity-rejected-notice"],
) {
  return (
    <Layout
      category="alert"
      eyebrow="Verification update"
      preview={`${vars.entityName} verification update`}
      title="Organisation verification unsuccessful"
    >
      <TextBlock>Hi {vars.recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        We were unable to approve <strong>{vars.entityName}</strong> at this time.
        {vars.rejectionReason ? <> Reason: {vars.rejectionReason}</> : null}
      </TextBlock>
      <Button href={vars.dashboardUrl} tone="subtle">
        View your organisations
      </Button>
      <HelpBlock email={vars.supportContactEmail} />
    </Layout>
  );
}

export const legalEntityDocsRequestedSubject = (
  vars: TemplateVarsByName["legal-entity-docs-requested-notice"],
) => `Documents needed for ${vars.entityName}`;

export function LegalEntityDocsRequestedNoticeEmail(
  vars: TemplateVarsByName["legal-entity-docs-requested-notice"],
) {
  return (
    <Layout
      category="alert"
      eyebrow="Documents needed"
      preview={`Upload documents for ${vars.entityName}`}
      title="Additional documents required"
    >
      <TextBlock>Hi {vars.recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        We need additional documents for <strong>{vars.entityName}</strong>. Upload them in your
        dashboard, then resubmit for review.
      </TextBlock>
      <Button href={vars.docsUrl}>Upload documents</Button>
      <HelpBlock email={vars.supportContactEmail} />
    </Layout>
  );
}
