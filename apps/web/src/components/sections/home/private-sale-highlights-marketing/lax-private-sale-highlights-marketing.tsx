import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import type { PrivateSaleHighlightVM } from "@/components/sections/home/home-view-models";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import { ButtonLink } from "@auction/ui/lax";
import Link from "next/link";
import { PrivateSaleHighlightsMarketing } from "./private-sale-highlights-marketing";

type Props = {
  highlights: PrivateSaleHighlightVM[];
};

/** Server entry for the home “Private Sale Highlights” band. */
export function LaxPrivateSaleHighlightsMarketing({ highlights }: Props) {
  if (highlights.length === 0) {
    return (
      <section
        aria-label="Private sale highlights"
        className={cn(MARKETING_PAGE_SHELL, "pb-0 pt-[var(--section-spacing-tight)]")}
      >
        <MarketingEmptyState
          variant="marketing"
          title="Private sale highlights"
          description="Acquire exceptional works outside the auction calendar. Contact us to learn more."
          action={
            <ButtonLink Link={Link} variant="secondary" href="/contact#message">
              Contact us
            </ButtonLink>
          }
        />
      </section>
    );
  }
  return <PrivateSaleHighlightsMarketing highlights={highlights} />;
}
