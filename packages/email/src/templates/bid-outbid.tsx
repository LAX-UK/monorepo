import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import { UnsubscribeFooter } from "../components/UnsubscribeFooter.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "You've been outbid";

export default function BidOutbidEmail({
  userName,
  lotTitle,
  lotUrl,
  currentBid,
  unsubscribeUrl,
}: TemplateVarsByName["bid-outbid"]) {
  return (
    <Layout preview={`You've been outbid on ${lotTitle}.`} title="You've been outbid">
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        Another bidder placed a higher bid on {lotTitle}. The current bid is {currentBid}.
      </TextBlock>
      <Button href={lotUrl}>View lot</Button>
      <UnsubscribeFooter unsubscribeUrl={unsubscribeUrl} />
    </Layout>
  );
}
