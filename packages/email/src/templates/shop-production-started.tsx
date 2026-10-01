import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Your LAX Shop print is in production";

export default function ShopProductionStartedEmail({
  artworkTitle,
  editionLabel,
}: TemplateVarsByName["shop-production-started"]) {
  return (
    <Layout
      category="auction"
      eyebrow="Production"
      preview={`${artworkTitle} ${editionLabel} is being printed.`}
      title="Your print is in production"
    >
      <TextBlock>
        We started production for {artworkTitle} ({editionLabel}).
      </TextBlock>
    </Layout>
  );
}
