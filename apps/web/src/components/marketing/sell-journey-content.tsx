import type { MarketingProcessStep } from "@/components/marketing/marketing-process-steps";
import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { Banknote, FileText, Gavel, Search, ShieldCheck, Tag, UserPlus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** CTA link label for the valuation section — distinct from intro/closing bands. */
export const SELL_VALUATION_CTA_LABEL = "Request a specialist review";

/** Extended consignment journey for `/sell` — icons + post-listing lifecycle. */
export const SELL_MARKETING_JOURNEY_STEPS: readonly MarketingProcessStep[] = [
  {
    id: "discover",
    title: "Discover",
    icon: Search,
    description: (
      <>
        Read what we accept and gather photos and details. See{" "}
        <a href="#departments" className={MARKETING_PROSE_LINK}>
          what we accept
        </a>
        .
      </>
    ),
  },
  {
    id: "account",
    title: "Account",
    icon: UserPlus,
    description: "Sign in with a verified email to save your progress.",
  },
  {
    id: "submit",
    title: "Submit",
    icon: FileText,
    description: "Complete the 6-step wizard — about 3 minutes.",
  },
  {
    id: "review",
    title: "Specialist review",
    icon: ShieldCheck,
    description: "Our team vets your object within 24 hours.",
  },
  {
    id: "listed",
    title: "Listed",
    icon: Tag,
    description:
      "Accepted work is catalogued, prepared for sale, and scheduled for an upcoming auction.",
  },
  {
    id: "sold",
    title: "Sold & settled",
    icon: Gavel,
    description: "When your lot sells, the buyer is invoiced and settles with LAX.",
  },
  {
    id: "payout",
    title: "Get paid",
    icon: Banknote,
    description:
      "Complete Stripe Connect after acceptance so we can transfer your proceeds once the buyer has paid.",
  },
];

/** Valuation section body — specialists assess via submission; no standalone appraisal tool. */
export function SellValuationIntro({ cta }: { cta: ReactNode }) {
  return (
    <p>
      Specialists provide guidance and estimates by reviewing your submission — there is no separate
      online appraisal form. Share key details and images via {cta}, or{" "}
      <Link href="/contact" className={MARKETING_PROSE_LINK}>
        contact our team
      </Link>{" "}
      for estates, corporate collections, and complex consignments. We respond within 24 hours.
    </p>
  );
}
