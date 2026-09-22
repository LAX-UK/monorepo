import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "An artwork you follow is available";

export default function ShopEditionAvailableNotifyEmail({
  artworkTitle,
  artworkUrl,
}: TemplateVarsByName["shop-edition-available-notify"]) {
  return (
    <Layout
      category="auction"
      eyebrow="Back in stock"
      preview={`${artworkTitle} is available again.`}
      title="Good news — editions are available"
    >
      <TextBlock>{artworkTitle} has sellable editions again on the LAX Shop.</TextBlock>
      <Button href={artworkUrl}>View artwork</Button>
    </Layout>
  );
}
