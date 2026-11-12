import { SellCtaLink } from "@/components/marketing/sell-cta-link";
import { MediaImage } from "@/components/ui/media-image";
import type { HomeSelling } from "@/lib/home-sections/types";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { SELL_HOW_IT_WORKS_STEPS } from "@/lib/marketing/sell-how-it-works";
import { sellIntakeHref } from "@/lib/marketing/sell-intake";
import { MarketingGalleryTeamBand } from "@auction/marketing-ui/marketing-gallery-team-band";
import { buttonVariants } from "@auction/ui/lax/button-variants";
import { cn } from "@auction/ui/lib/utils";
import Link from "next/link";

const BODY =
  "Our specialists value paintings, prints, design and collections for free, and tell you which sale suits the work.";

function Works({ imageUrls }: { imageUrls: readonly string[] }) {
  if (imageUrls.length === 0) {
    return (
      <MediaImage
        src={null}
        alt=""
        label="Works at LAX Bid"
        className="absolute inset-0 size-full"
      />
    );
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-4 bg-lax-paper p-7 md:gap-7 md:p-12">
      {imageUrls.map((url) => (
        <div key={url} className="relative h-full min-w-0 flex-1">
          <MediaImage
            src={url}
            alt=""
            label="Work sold at LAX Bid"
            className="absolute inset-0 size-full"
            imgClassName="object-contain"
            sizes="(max-width: 768px) 40vw, 20vw"
          />
        </div>
      ))}
    </div>
  );
}

/** The family gallery-team band, saying how selling works and when consignments close. */
export function HomeSellingBand({ selling }: { selling: HomeSelling }) {
  return (
    <section id="selling" className="pt-16 md:pt-24">
      <div className={MARKETING_PAGE_SHELL}>
        <MarketingGalleryTeamBand
          eyebrow="Selling with LAX Bid"
          eyebrowTone="neutral"
          steps={SELL_HOW_IT_WORKS_STEPS}
          title="Thinking of selling?"
          body={BODY}
          {...(selling.deadlineNote ? { note: selling.deadlineNote } : {})}
          media={<Works imageUrls={selling.imageUrls} />}
          actions={
            <>
              <SellCtaLink
                href={sellIntakeHref()}
                source="home_consign"
                className={cn(buttonVariants({ variant: "primary" }), "max-md:w-full")}
              >
                Request a valuation
              </SellCtaLink>
              <Link
                href="/sell"
                className={cn(buttonVariants({ variant: "secondary" }), "max-md:w-full")}
              >
                How selling works
              </Link>
            </>
          }
        />
      </div>
    </section>
  );
}
