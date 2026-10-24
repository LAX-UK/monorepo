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
  hammerPrice,
  totalDue,
}: TemplateVarsByName["lot-won"]) {
  const bidLine =
    hammerPrice && totalDue
      ? `You won ${lotTitle} with a hammer price of ${hammerPrice} (total due ${totalDue}).`
      : winningBid
        ? `You won ${lotTitle} with a winning bid of ${winningBid}.`
        : `You won ${lotTitle}.`;
  return (
    <Layout
      category="auction"
      eyebrow="Auction won"
      preview={`You won ${lotTitle}.`}
      title="Congratulations, you won"
      unsubscribeUrl={unsubscribeUrl}
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>{bidLine} Complete payment from checkout when you are ready.</TextBlock>
      <Button href={paymentUrl || lotUrl}>Go to checkout</Button>
    </Layout>
  );
}
