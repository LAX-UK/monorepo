import { GALLERY_CONTACT } from "@auction/branding";
import { LAX_ART_POLICIES, type LegalPolicyDocument } from "@auction/marketing-ui";
import { QUOTE_HOLD_WORKING_DAYS, QUOTE_PAYMENT_WINDOW_MS } from "@auction/shop-domain";
import { SHOP_POLICY_PATHS, SHOP_POLICY_SOURCES } from "./shop-policy-status";

/** Contact details for the help page; the phone and email are the gallery's, from the shared contact. */
export const SHOP_HELP_CONTACT = {
  email: GALLERY_CONTACT.email.replace("@", "(@)"),
  emailHref: `mailto:${GALLERY_CONTACT.email}`,
  phone: `Phone: ${GALLERY_CONTACT.phone}`,
  address: "156 New Cavendish St, London W1W 6YW",
} as const;

const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? "" : "s"}`;

/** "one hour" or "30 minutes", from the payment window the quote flow really applies. */
export function quotePaymentWindowWords(ms: number = QUOTE_PAYMENT_WINDOW_MS): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "one hour" : plural(hours, "hour");
  }
  return plural(minutes, "minute");
}

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
            text: "Where we have not set a fixed price, our gallery team quotes delivery outside the UK for each order. You ask for a quote at checkout instead of paying for delivery straight away. Where a fixed price is set, you pay it with your order and there is no quote to wait for.",
          },
          {
            type: "list",
            items: [
              "Ask for a quote at checkout. Nothing is charged, and we hold your print while we work out the price.",
              "We email you the price within one working day. It covers packing, insured delivery and export paperwork.",
              "Accept the quote from our email.",
              `Once you accept, you have ${quotePaymentWindowWords()} to pay for your print and its delivery together.`,
              "We send your print once payment has cleared. Once you have paid, your invoice is on your order page, whether you are signed in or checked out as a guest.",
            ],
          },
          {
            type: "paragraph",
            text: `Your confirmation at checkout and our quote email show the exact date your print is held until. The hold can be shorter for guests than for signed-in buyers, and once we send your quote we hold it for ${plural(QUOTE_HOLD_WORKING_DAYS, "working day")}. If you have not paid by the date shown, we release the print and you can ask again. Import duties, taxes and customs charges in your country are yours to pay and are not in the quote.`,
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
