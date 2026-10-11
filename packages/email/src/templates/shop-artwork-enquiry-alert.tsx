import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "New Shop artwork enquiry";

export default function ShopArtworkEnquiryAlertEmail({
  artworkTitle,
  artworkSlug,
  artworkUrl,
  buyerEmail,
  message,
  contactPhone,
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
      <TextBlock>View artwork: {artworkUrl}</TextBlock>
      <TextBlock>Contact email on file: {buyerEmail}</TextBlock>
      {contactPhone ? <TextBlock>Contact phone: {contactPhone}</TextBlock> : null}
      {message ? <TextBlock>Message: {message}</TextBlock> : null}
    </Layout>
  );
}
