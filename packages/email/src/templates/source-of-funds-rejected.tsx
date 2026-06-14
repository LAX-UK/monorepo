import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = () => "Source of funds review — outcome";

export default function SourceOfFundsRejectedEmail(
  vars: TemplateVarsByName["source-of-funds-rejected"],
) {
  const { userName, settlementSummary, dashboardUrl, supportContactEmail } = vars;

  return (
    <Layout
      category="alert"
      eyebrow="Compliance · Review outcome"
      preview="We were unable to verify your source of funds at this time."
      title="Source of funds not verified"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        We have completed our review of your source of funds
        {settlementSummary ? ` relating to ${settlementSummary}` : ""}. Unfortunately we were unable
        to verify the information provided, and checkout remains on hold.
      </TextBlock>
      <TextBlock>
        Our compliance team will contact you if further action is required. You can view the status
        of your case in your account.
      </TextBlock>
      <TextBlock>
        <a href={dashboardUrl} style={{ color: "#2563eb", fontWeight: 600 }}>
          View compliance status
        </a>
      </TextBlock>
      <HelpBlock email={supportContactEmail} />
    </Layout>
  );
}
