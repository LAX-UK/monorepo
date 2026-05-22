import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import type { PrivateSaleHighlightVM } from "@/components/sections/home/home-view-models";
import { Button } from "@auction/ui";
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
        id="private-sale-heading"
        aria-labelledby="home-private-sale-heading"
        className="mx-auto w-full max-w-[var(--container-max,1440px)] px-8 pb-0 pt-10 md:px-10 lg:px-14"
      >
        <MarketingEmptyState
          variant="marketing"
          title="Private sale highlights"
          description="Acquire exceptional works outside the auction calendar. Contact us to learn more."
          action={
            <Button variant="outline" asChild>
              <Link href="/contact#message">Contact us</Link>
            </Button>
          }
        />
      </section>
    );
  }
  return <PrivateSaleHighlightsMarketing highlights={highlights} />;
}
