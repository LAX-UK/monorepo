import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (_vars: TemplateVarsByName["source-of-funds-documents-requested"]) =>
  "Action required: upload your source of funds documents";

export default function SourceOfFundsDocumentsRequestedEmail(
  vars: TemplateVarsByName["source-of-funds-documents-requested"],
) {
  const {
    userName,
    documentTypes,
    requestNote,
    uploadUrl,
    settlementSummary,
    supportContactEmail,
  } = vars;

  return (
    <Layout
      category="alert"
      eyebrow="Compliance · Documents requested"
      preview="Our compliance team has requested specific documents to verify your source of funds."
      title="Please upload your documents securely"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      {settlementSummary ? (
        <TextBlock>
          This relates to your purchase activity: <strong>{settlementSummary}</strong>.
        </TextBlock>
      ) : null}
      <TextBlock>
        Our compliance team has requested the following documents. Please upload them through your
        secure account area — do not email attachments.
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
        {documentTypes.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      {requestNote ? (
        <TextBlock>
          <strong>Note from our team:</strong> {requestNote}
        </TextBlock>
      ) : null}
      <TextBlock>
        <a href={uploadUrl} style={{ color: "#2563eb", fontWeight: 600 }}>
          Upload documents securely
        </a>
      </TextBlock>
      <HelpBlock email={supportContactEmail} />
    </Layout>
  );
}
