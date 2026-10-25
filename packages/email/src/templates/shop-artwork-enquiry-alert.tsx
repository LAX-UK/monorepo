import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["shop-artwork-enquiry-alert"];

const STOREFRONT_LABEL = { shop: "Shop", art: "lax.art" } as const;

function storefrontLabel(storefront: Vars["storefront"]): string {
  return STOREFRONT_LABEL[storefront ?? "shop"];
}

export const subject = ({ storefront }: Vars) =>
  `New ${storefrontLabel(storefront)} artwork enquiry`;

export default function ShopArtworkEnquiryAlertEmail({
  artworkTitle,
  artworkSlug,
  artworkUrl,
  buyerEmail,
  buyerName,
  guest,
  message,
  contactPhone,
  storefront,
}: Vars) {
  return (
    <Layout
      category="alert"
      eyebrow={`${storefrontLabel(storefront)} enquiry`}
      preview={`Enquiry for ${artworkTitle}.`}
      title="Original artwork enquiry"
    >
      <TextBlock>
        A buyer registered interest in {artworkTitle} ({artworkSlug}).
      </TextBlock>
      <TextBlock>View artwork: {artworkUrl}</TextBlock>
      {buyerName ? <TextBlock>Name: {buyerName}</TextBlock> : null}
      <TextBlock>
        {guest ? "Contact email (sent without a LAX account)" : "Contact email on file"}:{" "}
        {buyerEmail}
      </TextBlock>
      {contactPhone ? <TextBlock>Contact phone: {contactPhone}</TextBlock> : null}
      {message ? <TextBlock>Message: {message}</TextBlock> : null}
    </Layout>
  );
}
