import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import { UnsubscribeFooter } from "../components/UnsubscribeFooter.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "You won the lot";

export default function LotWonEmail({
  userName,
  lotTitle,
  lotUrl,
  winningBid,
  paymentUrl,
  unsubscribeUrl,
}: TemplateVarsByName["lot-won"]) {
  return (
    <Layout preview={`You won ${lotTitle}.`} title="Congratulations, you won">
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        You won {lotTitle} with a winning bid of {winningBid}. Complete payment from your account
        when ready.
      </TextBlock>
      <Button href={paymentUrl || lotUrl}>Review next steps</Button>
      <UnsubscribeFooter unsubscribeUrl={unsubscribeUrl} />
    </Layout>
  );
}
