import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Your LAX Shop order is on its way";

export default function ShopDispatchNoticeEmail({
  artworkTitle,
  trackingUrl,
  fulfilmentSummary,
}: TemplateVarsByName["shop-dispatch-notice"]) {
  return (
    <Layout
      category="auction"
      eyebrow="Dispatch"
      preview={`${artworkTitle} has been dispatched.`}
      title="Your order has been dispatched"
    >
      <TextBlock>{fulfilmentSummary}</TextBlock>
      {trackingUrl ? <Button href={trackingUrl}>Track delivery</Button> : null}
    </Layout>
  );
}
