import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "An update on your purchase";

/**
 * One email for each step of getting a purchased lot to its buyer: ready to collect, shipped, and
 * delivered or collected. The sender writes the heading and the message.
 */
export default function LotFulfilmentUpdateEmail({
  userName,
  lotTitle,
  heading,
  message,
  purchaseUrl,
}: TemplateVarsByName["lot-fulfilment-update"]) {
  return (
    <Layout
      category="auction"
      eyebrow="Order update"
      preview={`${heading}: ${lotTitle}.`}
      title={heading}
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>{message}</TextBlock>
      <Button href={purchaseUrl}>View your purchase</Button>
    </Layout>
  );
}
