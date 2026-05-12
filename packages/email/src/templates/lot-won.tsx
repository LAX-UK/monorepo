import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
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
    <Layout
      category="auction"
      eyebrow="Auction won"
      preview={`You won ${lotTitle}.`}
      title="Congratulations, you won"
      unsubscribeUrl={unsubscribeUrl}
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        You won {lotTitle} with a winning bid of {winningBid}. Complete payment from your account
        when ready.
      </TextBlock>
      <Button href={paymentUrl || lotUrl}>Review next steps</Button>
    </Layout>
  );
}
