import { SellCtaLink } from "@/components/marketing/sell-cta-link";
import { MediaImage } from "@/components/ui/media-image";
import { REPLY_WINDOW } from "@/lib/copy/glossary";
import type { HomeSelling } from "@/lib/home-sections/types";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { sellIntakeHref } from "@/lib/marketing/sell-intake";
import { MarketingGalleryTeamBand } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { buttonVariants } from "@auction/ui/lax";
import Link from "next/link";

const BODY =
  "Our specialists value paintings, prints, design and collections for free, and tell you which sale suits the work.";

const STEPS = [
  { title: "Tell us about it", body: "Photos and a few details, in about three minutes." },
  { title: "Free valuation", body: `A specialist’s estimate, usually ${REPLY_WINDOW}.` },
  { title: "Consign", body: "We catalogue, photograph and sell it, and pay you after the sale." },
] as const;

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
          steps={STEPS}
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
