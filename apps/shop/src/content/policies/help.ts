import { GALLERY_CONTACT } from "@auction/branding";
import { LAX_ART_POLICIES, type LegalPolicyDocument } from "@auction/marketing-ui";
import { SHOP_POLICY_PATHS, SHOP_POLICY_SOURCES } from "./shop-policy-status";

/** Contact details for the help page; the phone and email are the gallery's, from the shared contact. */
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
