import { Button } from "../components/Button.js";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["legal-entity-archived-notice"]) =>
  `${vars.entityName} has been archived on LAX`;

export default function LegalEntityArchivedNoticeEmail(
  vars: TemplateVarsByName["legal-entity-archived-notice"],
) {
  const { recipientFirstName, entityName, dashboardUrl, supportContactEmail } = vars;
  return (
    <Layout
      category="alert"
      eyebrow="Organisation archived"
      preview={`${entityName} archived`}
      title="Organisation archived"
    >
      <TextBlock>Hi {recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        <strong>{entityName}</strong> has been archived by platform administrators. Active bidding
        on behalf of this organisation may have been adjusted, and draft listings linked to this
        entity have been flagged for admin review.
      </TextBlock>
      <HelpBlock email={supportContactEmail} />
      <Button href={dashboardUrl} tone="subtle">
        Open your dashboard
      </Button>
    </Layout>
  );
}
