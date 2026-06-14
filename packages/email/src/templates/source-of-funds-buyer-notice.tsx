import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (_vars: TemplateVarsByName["source-of-funds-buyer-notice"]) =>
  "Action required: source of funds verification for your purchase";

export default function SourceOfFundsBuyerNoticeEmail(
  vars: TemplateVarsByName["source-of-funds-buyer-notice"],
) {
  const { userName, supportContactEmail, settlementSummary } = vars;

  return (
    <Layout
      category="alert"
      eyebrow="Compliance · Action required"
      preview="We need to verify the source of funds for your purchase before settlement can proceed."
      title="Source of funds verification required"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      {settlementSummary ? (
        <TextBlock>
          This review relates to: <strong>{settlementSummary}</strong>.
        </TextBlock>
      ) : null}
      <TextBlock>
        As part of our anti-money laundering obligations, we need to verify the source of funds for
        your recent purchase before settlement can be completed. Your checkout is currently on hold
        pending this review.
      </TextBlock>
      <TextBlock>
        Our compliance team will contact you with secure instructions. Please do{" "}
        <strong>not</strong> send any documents until you have received those instructions. Typical
        documents we may ask for include:
      </TextBlock>
      <ul
        style={{
          fontFamily: "inherit",
          fontSize: "14px",
          lineHeight: "1.6",
          margin: "0 0 16px",
          paddingLeft: "20px",
          color: "#374151",
        }}
      >
        <li>Bank statements covering the funds used for this purchase</li>
        <li>Proof of sale or liquidation if proceeds funded the bid</li>
        <li>Documentation for inheritance, gift, or corporate treasury sources if applicable</li>
      </ul>
      <TextBlock>
        Once your source of funds is verified, your checkout will be released automatically. We aim
        to complete reviews within 5 business days.
      </TextBlock>
      <HelpBlock email={supportContactEmail} />
    </Layout>
  );
}
