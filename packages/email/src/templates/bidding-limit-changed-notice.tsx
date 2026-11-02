import { FactCard } from "../components/FactCard.js";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["bidding-limit-changed-notice"]) =>
  vars.scope === "sale"
    ? `Your bidding limit for ${vars.scopeName} changed`
    : `The bidding limit for ${vars.scopeName} changed`;

const NO_LIMIT = "No limit";

export default function BiddingLimitChangedNoticeEmail(
  vars: TemplateVarsByName["bidding-limit-changed-notice"],
) {
  const sale = vars.scope === "sale";
  return (
    <Layout
      category="auction"
      eyebrow="Bidding limit"
      preview={`The bidding limit for ${vars.scopeName} changed.`}
      title="Bidding limit changed"
    >
      <TextBlock>Hi {vars.recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        {sale ? (
          <>
            Our team changed your bidding limit for <strong>{vars.scopeName}</strong>.
          </>
        ) : (
          <>
            Our team changed the bidding limit for <strong>{vars.scopeName}</strong>. It applies to
            everyone bidding for the organisation.
          </>
        )}{" "}
        Bids you have already placed stand. The new limit applies to bids from now on.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Previous limit", value: vars.previousLimit ?? NO_LIMIT },
          { label: "New limit", value: vars.newLimit ?? NO_LIMIT },
        ]}
      />
      <HelpBlock email={vars.supportContactEmail} />
    </Layout>
  );
}
