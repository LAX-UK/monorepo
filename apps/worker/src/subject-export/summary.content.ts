import { GALLERY_CONTACT, LEGAL_ENTITIES, SITE_SUPPORT_EMAIL } from "@auction/branding";
import type { SubjectExportProduct } from "@auction/identity-contracts";

/** What each product tells the person about its use of their data. Plain sentences, one idea each. */
export type ProductDisclosure = {
  purposes: readonly string[];
  recipients: readonly string[];
  retention: readonly string[];
  sources: readonly string[];
};

export const PRODUCT_DISCLOSURES: Readonly<Record<SubjectExportProduct, ProductDisclosure>> = {
  account: {
    purposes: [
      "To sign you in and keep your account secure.",
      "To keep one name, contact details and address book across the LAX products you use.",
      "To record the terms and choices you accepted.",
    ],
    recipients: [
      "The LAX products you use (LAX Bid, LAX Shop and lax.art) receive your name, email address and the details you choose to share with them.",
      "Our email delivery provider sends the emails about your account.",
    ],
    retention: [
      "While your account exists.",
      "If you delete your account there is a 30-day period to change your mind, after which your personal data is removed.",
    ],
    sources: ["You, when you register and change your details.", "Your devices, when you sign in."],
  },
  bid: {
    purposes: [
      "To register you to bid, take your bids and tell you the result.",
      "To invoice you, collect payment and arrange delivery or collection.",
      "To handle works you consign to sale.",
      "To carry out the identity and financial checks the law requires of an auction house.",
    ],
    recipients: [
      "Stripe takes your payments.",
      "Xero keeps our accounting records.",
      "Zoho holds customer records and sends our emails.",
      "Couriers receive the name, address and phone number needed to deliver.",
      "Regulators and law enforcement, where the law requires it.",
    ],
    retention: [
      "Records of sales, invoices and payments are kept as long as the law requires for accounting.",
      "Identity-check records are kept for five years after our relationship ends, for the regulator.",
      "After you delete your account, the records we must keep are held under a pseudonym and are no longer linked to a login.",
    ],
    sources: [
      "You: what you typed, chose or uploaded.",
      "Your use of LAX Bid: bids, registrations and sign-ins.",
      "Our team: decisions and statuses such as an approved registration.",
    ],
  },
  shop: {
    purposes: [
      "To take and deliver your orders, and take payment.",
      "To issue invoices and handle returns.",
      "To answer your enquiries and handle artist applications.",
    ],
    recipients: [
      "Stripe takes your payments.",
      "Xero keeps our accounting records.",
      "Zoho holds customer records and sends our emails.",
      "Couriers receive the name, address and phone number needed to deliver.",
      "Regulators and law enforcement, where the law requires it.",
    ],
    retention: [
      "Financial records are kept for six years.",
      "Other information is kept while your account exists.",
    ],
    sources: [
      "You: what you typed, chose or uploaded.",
      "Your use of LAX Shop and lax.art: orders, saved works and enquiries.",
      "Our team: statuses such as an approved application.",
    ],
  },
};

/** Held by other companies, or kept back by law, and so not in the copy. */
export const NOT_HELD_BY_LAX: readonly { title: string; detail: string }[] = [
  {
    title: "Card and bank details",
    detail:
      "Stripe holds them. LAX keeps the card brand and last four digits only. Stripe is a separate company with its own privacy notice.",
  },
  {
    title: "Accounting records",
    detail: "Xero, our accounting system, holds copies of invoices and payments.",
  },
  {
    title: "Customer records and email campaigns",
    detail: "Zoho holds the contact records and emails our team uses.",
  },
  {
    title: "Delivery tracking",
    detail: "Couriers hold their own records of a delivery once they have collected it.",
  },
  {
    title: "Notes our team keeps and risk checks",
    detail:
      "Staff notes, and the anti-money-laundering and risk assessments we are required to carry out, are not in this automatic copy. Some are exempt from the right of access. Ask for a full copy and we will tell you what we can share.",
  },
];

export type RightsContact = {
  heading: string;
  company: string;
  address: string;
  email: string;
  phone: string | null;
};

const ENTITY_ADDRESS = LEGAL_ENTITIES["london-auction-xchange"].registeredAddress.inline;

/** Who to write to, by product: each company answers for its own data. */
export const RIGHTS_CONTACTS: readonly RightsContact[] = [
  {
    heading: "LAX Bid",
    company: LEGAL_ENTITIES["london-auction-xchange"].name,
    address: ENTITY_ADDRESS,
    email: SITE_SUPPORT_EMAIL,
    phone: null,
  },
  {
    heading: "LAX Shop and lax.art",
    company: LEGAL_ENTITIES["london-art-exchange"].name,
    address: LEGAL_ENTITIES["london-art-exchange"].registeredAddress.inline,
    email: GALLERY_CONTACT.email,
    phone: GALLERY_CONTACT.phone,
  },
];

export const RIGHTS: readonly string[] = [
  "See the information we hold about you (this copy is part of that).",
  "Ask us to correct what is wrong or incomplete.",
  "Ask us to delete your information, or to restrict how we use it.",
  "Take your data to another service. The JSON files in this copy are made for that.",
  "Object to how we use your information, or withdraw a consent you gave.",
  "Ask for a full copy, including what needs a person to review.",
];

export const ICO = {
  name: "the Information Commissioner's Office (ICO)",
  url: "https://ico.org.uk",
  phone: "0303 123 1113",
};
