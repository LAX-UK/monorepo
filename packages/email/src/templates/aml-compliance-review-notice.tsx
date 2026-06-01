import { COLORS } from "@auction/branding";
import { Link } from "@react-email/components";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

const KIND_LABEL: Record<TemplateVarsByName["aml-compliance-review-notice"]["kind"], string> = {
  screening: "Sanctions / PEP / adverse-media match",
  source_of_funds: "Source-of-Funds review",
};

export const subject = (vars: TemplateVarsByName["aml-compliance-review-notice"]) =>
  `Compliance review required: ${KIND_LABEL[vars.kind]}`;

export default function AmlComplianceReviewNoticeEmail(
  vars: TemplateVarsByName["aml-compliance-review-notice"],
) {
  const { recipientFirstName, kind, caseReference, detail, adminReviewUrl } = vars;
  const kindLabel = KIND_LABEL[kind];

  return (
    <Layout
      category="alert"
      eyebrow="Compliance · MLRO escalation"
      preview={`Compliance review required: ${kindLabel}`}
      title="Compliance review required"
    >
      <TextBlock>
        {recipientFirstName ? `${recipientFirstName}, ` : ""}a case requires MLRO / compliance
        review. Money-path progression is held until it is dispositioned.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Type", value: kindLabel },
          { label: "Detail", value: detail },
          { label: "Reference", value: caseReference, mono: true },
        ]}
      />
      <TextBlock>
        Open the{" "}
        <Link href={adminReviewUrl} style={{ color: COLORS.link, textDecoration: "underline" }}>
          compliance review queue
        </Link>{" "}
        to triage and decide. Do not action the decision on a case you triaged (four-eyes).
      </TextBlock>
    </Layout>
  );
}
