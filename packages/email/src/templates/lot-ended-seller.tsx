import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import { UnsubscribeFooter } from "../components/UnsubscribeFooter.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Your lot has ended";

export default function LotEndedSellerEmail({
  userName,
  lotTitle,
  lotUrl,
  saleUrl,
  unsubscribeUrl,
}: TemplateVarsByName["lot-ended-seller"]) {
  return (
    <Layout preview={`${lotTitle} has ended.`} title="Your lot has ended">
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        The auction window for {lotTitle} has ended. You can review the result from your dashboard.
      </TextBlock>
      <Button href={saleUrl || lotUrl}>Review lot</Button>
      <UnsubscribeFooter unsubscribeUrl={unsubscribeUrl} />
    </Layout>
  );
}
