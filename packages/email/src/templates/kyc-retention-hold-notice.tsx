import { FactCard } from "../components/FactCard.js";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["kyc-retention-hold-notice"]) =>
  vars.count === 1
    ? "A private sale hold on KYC evidence needs a look"
    : `${vars.count} private sale holds on KYC evidence need a look`;

/**
 * The KYC retention purge keeps a party's evidence while a private sale deal's record is retained.
 * Two holds are not released by the clock, so a person has to look at them: one with no end date,
 * and an open deal that has not moved for longer than the retention period.
 */
export default function KycRetentionHoldNoticeEmail(
  vars: TemplateVarsByName["kyc-retention-hold-notice"],
) {
  const { recipientFirstName, lines, count, supportContactEmail } = vars;
  const more = count - lines.length;
  return (
    <Layout
      category="alert"
      eyebrow="Compliance · retention"
      preview={subject(vars)}
      title="KYC evidence is being kept for a deal that needs a look"
    >
      <TextBlock>
        {recipientFirstName ? `${recipientFirstName}, ` : ""}the KYC retention purge is keeping
        identity, screening and source-of-funds evidence for the deals below, and nothing will
        release it by itself.
      </TextBlock>
      <FactCard rows={lines.map((line, i) => ({ label: `Deal ${i + 1}`, value: line }))} />
      {more > 0 ? <TextBlock>and {more} more.</TextBlock> : null}
      <TextBlock>
        A deal with no recorded end date needs its end recorded or the deal looked into. An open
        deal that has not moved for longer than the retention period needs to be finished, cancelled
        or explained. The purge will not delete the evidence until each deal's record has run its
        retention.
      </TextBlock>
      <HelpBlock email={supportContactEmail} />
    </Layout>
  );
}
