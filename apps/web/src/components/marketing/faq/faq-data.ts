import {
  SITE_BUYERS_PREMIUM_STANDARD,
  SITE_CONSIGNMENT_EMAIL,
  SITE_CONTACT_EMAIL,
  SITE_PRESS_EMAIL,
  SITE_SUPPORT_EMAIL,
  SITE_TELEPHONE_DISPLAY,
} from "@/lib/brand";
import {
  getOnlineBiddingSummary,
  getOnsiteNoWebBiddingNote,
  getOnsiteParticipationSummary,
} from "@/lib/sale-type-presentation";
import type { ReactNode } from "react";

export type FaqItem = {
  /** Stable id used for accordion `value`, anchor links, and JSON-LD `@id`. */
  id: string;
  title: string;
  /** Plain text — always available so JSON-LD/FAQ rich results work. */
  body: string;
  /** Optional richer body for rendering. When omitted, consumers should fall
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
        body: "Create a LAX.BID account and complete your buyer profile. Buyer agents must register and be approved for each sale before placing bids on that sale. Identity verification may also be required depending on your activity and the lots you bid on.",
      },
      {
        id: "verification-before-bidding",
        title: "Do I need to be verified before bidding?",
        body: "Identity verification is required before you can bid, but it is not always completed before your first registration step. Requirements are applied when thresholds are reached or when additional checks are needed for a sale or lot.",
      },
      {
        id: "how-bidding-works",
        title: "How does bidding work?",
        body: `${getOnlineBiddingSummary()} ${getOnsiteParticipationSummary()} ${getOnsiteNoWebBiddingNote()}`,
      },
      {
        id: "bidding-increments",
        title: "What are bidding increments?",
        body: "Bidding increases in predetermined increments, which are set relative to the current bid level. These increments are displayed within the auction interface.",
      },
      {
        id: "advance-bids",
        title: "Can I place bids in advance?",
        body: "Online timed sales support confidential maximum bids when auto-bid is enabled for a lot — the platform bids the minimum increment needed to keep you leading up to your limit. In-person saleroom sales do not accept web bids; submit an absentee bid request or telephone bidding request before your lot opens instead.",
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
        body: `Start with our selling guide at /sell, then sign in to complete the submission wizard (about 3 minutes). Gather photos, title, dimensions, and provenance before you begin. You can also contact our team at ${SITE_CONSIGNMENT_EMAIL} or use the contact form for estate and corporate enquiries.`,
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
      {
        id: "accept-watches-cars",
        title: "Do you accept watches and motor cars?",
        body: "Yes. We review wristwatches, pocket watches, clocks, and collectible motor cars through the same submission wizard as fine art. See our selling guide at /sell#departments for department-specific photo guidance, or visit /sell/watches and /sell/motor-cars for tailored preparation tips.",
      },
      {
        id: "accept-design-books-coins",
        title: "Do you accept design furniture, books, or coins?",
        body: "We review design and decorative arts, books and manuscripts, and coins and medals when they align with upcoming sales. Submit through the wizard at /sell with clear photographs and provenance where available.",
      },
      {
        id: "watch-car-photos",
        title: "What photos do you need for a watch or motor car?",
        body: "For watches: dial, caseback, movement, and box or papers where available — include the reference number in your notes. For motor cars: exterior angles, interior, VIN plate, odometer, and engine bay. Avoid heavy filters; natural light works best.",
      },
      {
        id: "jewellery-handbags",
        title: "Do you accept jewellery and handbags?",
        body: `Jewellery and designer handbags are reviewed by specialist enquiry before intake. Contact our team at ${SITE_CONSIGNMENT_EMAIL} or use the contact form with intent=selling — we will confirm suitability and next steps.`,
      },
      {
        id: "single-vs-collection",
        title: "Should I submit one item or contact you for a collection?",
        body: "Single items can be submitted through the wizard in about 3 minutes. Estates, corporate collections, and multi-item consignments should use /sell/estate or /sell/corporate, or contact us with an inventory list and representative photographs.",
      },
      {
        id: "minimum-standards",
        title: "What are your minimum standards for consignment?",
        body: "All submissions are subject to internal review for suitability, market positioning, and alignment with upcoming sales. We do not guarantee acceptance or sale. Clear images, accurate dimensions, and honest condition information help specialists assess your item faster.",
      },
      {
        id: "maker-field",
        title: "Do I need to name the artist or maker?",
        body: "Include the artist, maker, or manufacturer in the title or description. The wizard does not have a separate maker field — use the title and catalogue description to identify who created or produced the item.",
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
