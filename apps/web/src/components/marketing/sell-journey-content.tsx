import type { MarketingProcessStep } from "@/components/marketing/marketing-process-steps";
import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { SPECIALIST_RESPONSE_PROMISE } from "@/lib/marketing/sell-flow-copy";
import { Banknote, FileText, Gavel, Search, ShieldCheck, Tag, UserPlus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** CTA link label for the valuation section — distinct from intro/closing bands. */
export const SELL_VALUATION_CTA_LABEL = "Request a specialist review";

/** Extended consignment journey for the step by step guide — icons + post-listing lifecycle. */
export const SELL_MARKETING_JOURNEY_STEPS: readonly MarketingProcessStep[] = [
  {
    id: "discover",
    title: "Discover",
    icon: Search,
    description: (
      <>
        Read what we accept and gather photos and details. See{" "}
        <Link href="/sell#departments" className={MARKETING_PROSE_LINK}>
          what we accept
        </Link>
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
    description: "Complete the six-step form, which takes about three minutes.",
  },
  {
    id: "review",
    title: "Specialist review",
    icon: ShieldCheck,
    description: "A specialist reviews your submission and usually replies within one working day.",
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
      "Set up your payout details after we accept the work, so we can transfer your proceeds once the buyer has paid.",
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
      for estates, corporate collections, and complex consignments. {SPECIALIST_RESPONSE_PROMISE}
    </p>
  );
}
