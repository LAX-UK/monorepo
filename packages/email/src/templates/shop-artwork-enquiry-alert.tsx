import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "New Shop artwork enquiry";

export default function ShopArtworkEnquiryAlertEmail({
  artworkTitle,
  artworkSlug,
  buyerEmail,
}: TemplateVarsByName["shop-artwork-enquiry-alert"]) {
  return (
    <Layout
      category="alert"
      eyebrow="Shop enquiry"
      preview={`Enquiry for ${artworkTitle}.`}
      title="Original artwork enquiry"
    >
      <TextBlock>
        A buyer registered interest in {artworkTitle} ({artworkSlug}).
      </TextBlock>
      <TextBlock>Contact email on file: {buyerEmail}</TextBlock>
    </Layout>
  );
}
