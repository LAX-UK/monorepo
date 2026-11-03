import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["sale-registration-decision-notice"]) =>
  vars.decision === "approved"
    ? `You can bid in ${vars.saleTitle}`
    : `Your request to bid in ${vars.saleTitle} was declined`;

export default function SaleRegistrationDecisionNoticeEmail(
  vars: TemplateVarsByName["sale-registration-decision-notice"],
) {
  const approved = vars.decision === "approved";
  return (
    <Layout
      category="auction"
      eyebrow="Bidding registration"
      preview={
        approved
          ? `You are registered to bid in ${vars.saleTitle}.`
          : `Your request to bid in ${vars.saleTitle} was declined.`
      }
      title={approved ? "You can bid in this sale" : "Registration declined"}
    >
      <TextBlock>Hi {vars.userName || "there"},</TextBlock>
      {approved ? (
        <>
          <TextBlock>
            Your request to bid in <strong>{vars.saleTitle}</strong> was approved. You can place
            bids as soon as lots are open.
          </TextBlock>
          <FactCard rows={[{ label: "Bidding limit", value: vars.bidLimit }]} />
          <Button href={vars.saleUrl}>View the sale</Button>
        </>
      ) : (
        <>
          <TextBlock>
            Your request to bid in <strong>{vars.saleTitle}</strong> was declined, so you can't
            place bids in this sale.
          </TextBlock>
          <FactCard rows={[{ label: "Reason", value: vars.reason }]} />
          <TextBlock>
            If you think this is a mistake, or you have more information to share, contact us and
            we'll take another look.
          </TextBlock>
        </>
      )}
      <HelpBlock email={vars.supportContactEmail} />
    </Layout>
  );
}
