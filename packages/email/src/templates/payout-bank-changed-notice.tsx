import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["payout-bank-changed-notice"];

export const subject = (vars: Vars) => `The payout bank account for ${vars.entityName} changed`;

/**
 * Sent to every owner, admin and finance member when the organisation's payout bank account is
 * added or changed. Bank changes are a common fraud route, so everyone who handles the money is
 * told, not only the person who changed it. It cannot be muted.
 */
export default function PayoutBankChangedNoticeEmail(vars: Vars) {
  const { userName, entityName, bankLast4, payoutsUrl } = vars;
  return (
    <Layout
      category="alert"
      eyebrow="Payouts"
      preview={`The payout bank account for ${entityName} changed.`}
      title="Payout bank account changed"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        The bank account that payouts for <strong>{entityName}</strong> go to has changed. We're
        telling every owner, admin and finance member of {entityName}.
      </TextBlock>
      {bankLast4 ? (
        <FactCard rows={[{ label: "Payouts now go to", value: `Account ending ${bankLast4}` }]} />
      ) : null}
      <TextBlock>
        If someone at {entityName} made this change, there's nothing more to do. If nobody did,
        contact us straight away, so we can hold payouts while we check.
      </TextBlock>
      <Button href={payoutsUrl} tone="subtle">
        Review payouts
      </Button>
      <HelpBlock />
    </Layout>
  );
}
