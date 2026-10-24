import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Your lot has closed";

export default function LotEndedSellerEmail({
  userName,
  lotTitle,
  lotUrl,
  saleUrl,
  outcome,
  hammerPrice,
  unsubscribeUrl,
}: TemplateVarsByName["lot-ended-seller"]) {
  const sold = outcome === "sold";
  return (
    <Layout
      category="auction"
      eyebrow={sold ? "Lot sold" : "Lot unsold"}
      preview={sold ? `${lotTitle} has sold.` : `${lotTitle} closed without a sale.`}
      title={sold ? "Your lot has sold" : "Your lot closed without a sale"}
      unsubscribeUrl={unsubscribeUrl}
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        {sold
          ? `${lotTitle} sold${hammerPrice ? ` with a hammer price of ${hammerPrice}` : ""}. The buyer now has the chance to pay, and we will update you as the sale settles.`
          : `${lotTitle} closed without a sale, either because it did not reach its reserve or because nobody bid. You can review the lot and decide what to do next from your consignments.`}
      </TextBlock>
      <Button href={saleUrl || lotUrl}>View your consignments</Button>
    </Layout>
  );
}
