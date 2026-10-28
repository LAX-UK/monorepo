import { LAX_ART_POLICIES, type LegalPolicyDocument } from "@auction/marketing-ui";
import { SHOP_POLICY_PATHS, SHOP_POLICY_SOURCES } from "./shop-policy-status";

/** The gallery's direct line, as www.thelax.art publishes it under "General Enquiries". */
export const SHOP_GALLERY_PHONE = { display: "020 804 41334", href: "tel:+442080441334" } as const;

/** The gallery's address for email, written out on the help page as www.thelax.art does. */
const GALLERY_EMAIL = "info@lax.art";

/** Contact details exactly as www.thelax.art shows them in its footer. */
export const SHOP_HELP_CONTACT = {
  email: GALLERY_EMAIL.replace("@", "(@)"),
  emailHref: `mailto:${GALLERY_EMAIL}`,
  sales: "Sales Office: +44 0800 208 4800",
  general: `General Enquiries: +44 ${SHOP_GALLERY_PHONE.display}`,
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
            items: [
              SHOP_HELP_CONTACT.email,
              SHOP_HELP_CONTACT.sales,
              SHOP_HELP_CONTACT.general,
              SHOP_HELP_CONTACT.address,
            ],
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
