import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = () => "Source of funds verified — you can complete checkout";

export default function SourceOfFundsApprovedEmail(
  vars: TemplateVarsByName["source-of-funds-approved"],
) {
  const { userName, settlementSummary, dashboardUrl, supportContactEmail } = vars;

  return (
    <Layout
      category="alert"
      eyebrow="Compliance · Verified"
      preview="Your source of funds has been verified. Checkout is now available."
      title="Source of funds verified"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        Good news — we have verified your source of funds
        {settlementSummary ? ` for ${settlementSummary}` : ""}. You can now complete checkout for
        your won lots.
      </TextBlock>
      <TextBlock>
        <a href={dashboardUrl} style={{ color: "#2563eb", fontWeight: 600 }}>
          Go to your dashboard
        </a>
      </TextBlock>
      <HelpBlock email={supportContactEmail} />
    </Layout>
  );
}
