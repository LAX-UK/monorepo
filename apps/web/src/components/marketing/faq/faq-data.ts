import {
  SITE_BUYERS_PREMIUM_STANDARD,
  SITE_CONSIGNMENT_EMAIL,
  SITE_CONTACT_EMAIL,
  SITE_PRESS_EMAIL,
  SITE_SUPPORT_EMAIL,
  SITE_TELEPHONE_DISPLAY,
} from "@/lib/brand";
import type { ReactNode } from "react";

export type FaqItem = {
  /** Stable id used for accordion `value`, anchor links, and JSON-LD `@id`. */
  id: string;
  title: string;
  /** Plain text — always available so JSON-LD/FAQ rich results work. */
  body: string;
  /**
   * Optional richer body for rendering. When omitted, consumers should fall
   * back to `body`.
   */
  bodyNode?: ReactNode;
};

export type FaqGroup = {
  id: string;
  title: string;
  items: FaqItem[];
};

export const faqGroups: FaqGroup[] = [
  {
    id: "buying",
    title: "Buying",
    items: [
      {
        id: "register-to-bid",
        title: "How do I register to bid?",
        body: "Participation in auctions requires a verified LAX.BID account. Registration can be completed online, after which users may be asked to provide additional documentation depending on the nature and value of the lots they intend to bid on.",
      },
      {
        id: "verification-before-bidding",
        title: "Do I need to be verified before bidding?",
        body: "Yes. Only verified users are permitted to place bids. Verification requirements are determined at the platform’s discretion and may include identity and payment validation.",
      },
      {
        id: "how-bidding-works",
        title: "How does bidding work?",
        body: "Bids may be placed in real time during live auctions or incrementally during timed sales. The highest accepted bid at the close of the auction constitutes the winning bid.",
      },
      {
        id: "bidding-increments",
        title: "What are bidding increments?",
        body: "Bidding increases in predetermined increments, which are set relative to the current bid level. These increments are displayed within the auction interface.",
      },
      {
        id: "advance-bids",
        title: "Can I place bids in advance?",
        body: "Where available, advance or maximum bids may be submitted ahead of a live sale. The platform will automatically increase bids on your behalf up to your specified limit.",
      },
      {
        id: "binding-bids",
        title: "Are bids legally binding?",
        body: "All bids submitted through LAX.BID are binding. By placing a bid, you are entering into a contractual obligation to complete the purchase if successful.",
      },
      {
        id: "withdraw-bid",
        title: "Can a bid be withdrawn or changed?",
        body: "Bids cannot be withdrawn once placed, except at the discretion of LAX.BID.",
      },
      {
        id: "highest-bidder",
        title: "What happens if I am the highest bidder?",
        body: "If your bid is successful, you will receive a formal invoice confirming the total amount due and payment instructions.",
      },
      {
        id: "buyers-premium",
        title: "Is there a buyer’s premium?",
        body: `A buyer’s premium of ${SITE_BUYERS_PREMIUM_STANDARD} is applied to the hammer price of each lot. This is displayed within the auction details and reflected in the final invoice issued to the successful bidder.`,
      },
      {
        id: "additional-charges",
        title: "Are there additional charges?",
        body: "Where applicable, VAT will be added in accordance with UK regulations. Additional costs may also include shipping, insurance, or other charges depending on the nature of the lot and delivery requirements.",
      },
      {
        id: "pay-successful-bid",
        title: "How do I pay for a successful bid?",
        body: "Payment must be completed within the timeframe stated on the invoice using an approved payment method. Details will be provided upon completion of the sale.",
      },
      {
        id: "ownership-transfer",
        title: "When does ownership transfer?",
        body: "Title to the lot transfers only once full cleared payment has been received.",
      },
      {
        id: "fail-to-pay",
        title: "What happens if I fail to pay?",
        body: "Failure to complete payment within the required timeframe may result in cancellation of the sale and restriction or suspension of your account.",
      },
      {
        id: "view-before-bidding",
        title: "Can I view a lot before bidding?",
        body: "Viewings may be arranged by appointment where applicable. Additional information, including condition reports, can be requested prior to bidding.",
      },
      {
        id: "condition-reports",
        title: "Are condition reports available?",
        body: "Condition reports and supporting information may be requested for most lots. These are provided to assist buyers but should be reviewed alongside all available material.",
      },
      {
        id: "authenticity",
        title: "Are all items authentic?",
        body: "All consignments undergo an internal review process prior to inclusion in an auction. Supporting documentation is provided where applicable.",
      },
      {
        id: "technical-issue",
        title: "What happens if there is a technical issue during an auction?",
        body: "In the event of technical disruption, LAX.BID reserves the right to take appropriate action, including pausing or restarting a sale where necessary.",
      },
      {
        id: "auction-changes",
        title: "Can auctions be changed or cancelled?",
        body: "LAX.BID reserves the right to amend, postpone, or withdraw any lot or sale at its discretion.",
      },
    ],
  },
  {
    id: "selling",
    title: "Selling",
    items: [
      {
        id: "consign-work",
        title: "How do I consign a work?",
        body: `Consignment enquiries can be submitted via the contact page or directly to the LAX.BID team at ${SITE_CONSIGNMENT_EMAIL}. Submissions are reviewed prior to acceptance.`,
      },
      {
        id: "submission-information",
        title: "What information should I provide when submitting a work?",
        body: "Submissions should include clear images, dimensions, medium, and any available provenance or supporting documentation. Additional information may be requested during the review process.",
      },
      {
        id: "items-selected",
        title: "How are items selected for auction?",
        body: "All consignments are subject to internal review. Selection is based on suitability, market positioning, and alignment with upcoming sales.",
      },
      {
        id: "estimate-determined",
        title: "How is the estimate determined?",
        body: "Estimates are set internally, taking into account comparable sales, current market conditions, and the context of the auction.",
      },
      {
        id: "reserve-price",
        title: "Is there a reserve price?",
        body: "Where appropriate, a reserve price may be agreed prior to the sale. This represents the minimum level at which a lot may be sold.",
      },
      {
        id: "guaranteed-sale",
        title: "Will my item be guaranteed a sale?",
        body: "No guarantees are provided. All lots are offered subject to bidding activity and market response.",
      },
      {
        id: "item-presentation",
        title: "How will my item be presented?",
        body: "Accepted consignments are prepared through structured cataloguing, including condition reporting and supporting detail. Each lot is positioned within a defined auction format.",
      },
      {
        id: "item-marketing",
        title: "How will my item be marketed?",
        body: "Lots are promoted through catalogue placement, targeted client outreach, and digital distribution aligned with the auction calendar.",
      },
      {
        id: "withdraw-consignment",
        title: "Can I withdraw my item after consignment?",
        body: "Withdrawal after acceptance may not be permitted, or may be subject to fees, depending on the stage of the sale.",
      },
      {
        id: "unsold-item",
        title: "What happens if my item does not sell?",
        body: "If a lot remains unsold, options may include re-offering in a future sale or alternative placement, subject to review.",
      },
      {
        id: "seller-payment",
        title: "When do I receive payment?",
        body: "Settlement is processed following receipt of cleared funds from the buyer, in accordance with agreed consignment terms.",
      },
      {
        id: "seller-fees",
        title: "Are there fees for selling?",
        body: "Seller terms, including commission and any associated costs, are agreed prior to consignment and confirmed in writing.",
      },
    ],
  },
  {
    id: "account-support",
    title: "Account & Support",
    items: [
      {
        id: "account-required",
        title: "Do I need an account to participate?",
        body: "Yes. All bidding activity requires a registered and verified account.",
      },
      {
        id: "bid-on-behalf",
        title: "Can I bid on behalf of someone else?",
        body: "Bids must be placed in the name of the registered account holder. Any third-party arrangements must be disclosed and approved in advance.",
      },
      {
        id: "information-handled",
        title: "How is my information handled?",
        body: "User data is managed in accordance with applicable data protection laws and is used solely for the operation of the platform and associated services.",
      },
      {
        id: "outside-hours-support",
        title: "Is support available outside of business hours?",
        body: "Platform support is monitored on a continuous basis. Response times may vary depending on the nature of the enquiry.",
      },
      {
        id: "contact-team",
        title: "How do I contact the team?",
        body: `General enquiries: ${SITE_CONTACT_EMAIL}. Support: ${SITE_SUPPORT_EMAIL}. Consignments: ${SITE_CONSIGNMENT_EMAIL}. Press: ${SITE_PRESS_EMAIL}. Telephone: ${SITE_TELEPHONE_DISPLAY}.`,
      },
    ],
  },
];

export const faqItems: FaqItem[] = faqGroups.flatMap((group) => group.items);

export type { ReactNode };
