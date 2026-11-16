import { GALLERY_CONTACT } from "@auction/branding";
import { LAX_ART_POLICIES, type LegalPolicyDocument } from "@auction/marketing-ui";
import { SHOP_POLICY_PATHS, SHOP_POLICY_SOURCES } from "./shop-policy-status";

/** Contact details for the help page; the phone and email are the gallery's, from the shared contact. */
/** Where the Help page explains delivery outside the UK; the quote steps and the delivery page link here. */
export const OUTSIDE_UK_HELP_HREF = "/help#delivery-outside-uk";

export const SHOP_HELP_CONTACT = {
  email: GALLERY_CONTACT.email.replace("@", "(@)"),
  emailHref: `mailto:${GALLERY_CONTACT.email}`,
  phone: `Phone: ${GALLERY_CONTACT.phone}`,
  address: "156 New Cavendish St, London W1W 6YW",
} as const;

const label = (slug: keyof typeof SHOP_POLICY_SOURCES) =>
  LAX_ART_POLICIES[SHOP_POLICY_SOURCES[slug]].label;

/**
 * Help and contact: the live contact details and links only, with no copy of its own. Account and
 * lax.art addresses depend on the deployment, so the page is built per request.
 */
export function buildShopHelpDocument(input: {
  ordersHref: string;
  accountHref: string;
  artBaseUrl: URL | null;
  /** lax.bid, where the full international delivery terms are; null when it is not configured. */
  bidBaseUrl?: URL | null;
}): LegalPolicyDocument<"help"> {
  const complaints = LAX_ART_POLICIES.complaints;
  return {
    slug: "help",
    title: "Help and contact",
    summary: "How to contact LAX Shop, with links to your orders and our policies.",
    sections: [
      {
        id: "contact-us",
        heading: "Contact us",
        blocks: [
          {
            type: "list",
            items: [SHOP_HELP_CONTACT.email, SHOP_HELP_CONTACT.phone, SHOP_HELP_CONTACT.address],
          },
        ],
      },
      {
        id: "your-orders",
        heading: "Your orders",
        blocks: [
          {
            type: "list",
            items: [`[Your orders](${input.ordersHref})`, `[LAX Account](${input.accountHref})`],
          },
        ],
      },
      {
        id: "delivery-outside-uk",
        heading: "Delivery outside the UK",
        blocks: [
          {
            type: "paragraph",
            text: "Our gallery team quotes delivery outside the UK for each order. You ask for a quote at checkout instead of paying for delivery straight away.",
          },
          {
            type: "list",
            items: [
              "Ask for a quote at checkout. Nothing is charged, and we hold your print while we work out the price.",
              "We email you the price within one working day. It covers packing, insured delivery and export paperwork.",
              "Pay for your print and its delivery together, from the link in our email.",
              "We send your print once payment has cleared. Your invoice is on your order page.",
            ],
          },
          {
            type: "paragraph",
            text: "We hold your print for up to three working days. If you have not paid by then, we release it and you can ask again. Import duties, taxes and customs charges in your country are yours to pay and are not in the quote.",
          },
          {
            type: "paragraph",
            text: input.bidBaseUrl
              ? `Read the full terms for [shipping and logistics](${new URL("/shipping", input.bidBaseUrl)}), or [contact us](mailto:${GALLERY_CONTACT.email}) if you are not sure we can deliver to you.`
              : `[Contact us](mailto:${GALLERY_CONTACT.email}) if you are not sure we can deliver to you.`,
          },
        ],
      },
      {
        id: "policies",
        heading: "Policies",
        blocks: [
          {
            type: "list",
            items: [
              `[${label("delivery")}](${SHOP_POLICY_PATHS.delivery})`,
              `[${label("returns")}](${SHOP_POLICY_PATHS.returns})`,
              `[${label("terms")}](${SHOP_POLICY_PATHS.terms})`,
              ...(input.artBaseUrl
                ? [`[${complaints.label}](${new URL(complaints.artPath, input.artBaseUrl)})`]
                : []),
            ],
          },
        ],
      },
    ],
  };
}
