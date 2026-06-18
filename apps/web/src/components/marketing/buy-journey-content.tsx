import { KYC_PROVIDER_NAME } from "@/components/kyc/kyc-copy";
import type { MarketingProcessStep } from "@/components/marketing/marketing-process-steps";
import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { CreditCard, Gavel, Receipt, Search, ShieldCheck, Truck, UserPlus } from "lucide-react";
import Link from "next/link";

/** Buy journey steps — data boundary (copy + icons). Presentation lives in MarketingProcessSteps. */
export const BUY_JOURNEY_STEPS: readonly MarketingProcessStep[] = [
  {
    id: "browse",
    title: "Browse & preview",
    icon: Search,
    description: (
      <>
        Start with our{" "}
        <Link href="/" className={MARKETING_PROSE_LINK}>
          upcoming auctions
        </Link>
        , review{" "}
        <Link href="/archive" className={MARKETING_PROSE_LINK}>
          past sales
        </Link>
        , or search for specific works through the{" "}
        <Link href="/search" className={MARKETING_PROSE_LINK}>
          catalogue search
        </Link>
        . Artist pages and lot detail pages include estimates, images, provenance notes, and
        condition information where available; you can also explore{" "}
        <Link href="/artists" className={MARKETING_PROSE_LINK}>
          featured artists
        </Link>
        .
      </>
    ),
  },
  {
    id: "register",
    title: "Register your account",
    icon: UserPlus,
    description: (
      <>
        Create an account before bidding. You must be 18 or over, provide accurate contact details,
        and agree to our{" "}
        <Link href="/terms" className={MARKETING_PROSE_LINK}>
          Conditions of Business
        </Link>
        . Buyer agents must register and be approved for each sale before bidding on it.
        Registration lets our client services team support bidding, invoices, shipping, and
        after-sale queries in one place.
      </>
    ),
  },
  {
    id: "verify",
    title: "Verify your identity",
    icon: ShieldCheck,
    description: (
      <>
        Identity verification may be required before you can bid. We use {KYC_PROVIDER_NAME} for a
        short check, typically using a government ID and a selfie. Requirements are applied when
        your bidding activity reaches our verification threshold, or when a specific sale or lot
        needs additional checks. If you have trouble completing verification, contact our{" "}
        <Link href="/contact" className={MARKETING_PROSE_LINK}>
          client services team
        </Link>{" "}
        before the sale starts.
      </>
    ),
  },
  {
    id: "bid",
    title: "Place a bid",
    icon: Gavel,
    description: (
      <>
        Once your account is set up and any required checks are complete, you can bid on{" "}
        <Link href="/sales" className={MARKETING_PROSE_LINK}>
          online and hybrid sales
        </Link>{" "}
        through the website. In-person onsite sales are bid by paddle in the room; absentee or
        telephone participation for those sales is requested through the website and executed by our
        saleroom team. Review the lot page carefully before bidding, including estimates, condition
        notes, sale timing, and any location or collection details. For format differences and
        common bidding questions, visit our{" "}
        <Link href="/faq" className={MARKETING_PROSE_LINK}>
          FAQ
        </Link>
        .
      </>
    ),
  },
  {
    id: "costs",
    title: "Buyer's premium & costs",
    icon: Receipt,
    description: (
      <>
        At checkout, winning bidders pay the hammer price plus buyer&apos;s premium. VAT, shipping,
        insurance, and other charges may apply under our{" "}
        <Link href="/terms" className={MARKETING_PROSE_LINK}>
          Conditions of Business
        </Link>{" "}
        and are invoiced separately.
      </>
    ),
  },
  {
    id: "payment",
    title: "Payment & settlement",
    icon: CreditCard,
    description: (
      <>
        After the sale, we issue an invoice with payment instructions and settlement timing. If you
        need help with payment, documentation, or buyer account details, contact{" "}
        <Link href="/contact" className={MARKETING_PROSE_LINK}>
          client services
        </Link>
        .
      </>
    ),
  },
  {
    id: "shipping",
    title: "Shipping & collection",
    icon: Truck,
    description: (
      <>
        Shipping and collection are arranged after payment. Fine art lots may require specialist
        packing, export documentation, and insured transit. Read our{" "}
        <Link href="/shipping" className={MARKETING_PROSE_LINK}>
          shipping and logistics
        </Link>{" "}
        guide before bidding if delivery timing or destination is important.
      </>
    ),
  },
];
