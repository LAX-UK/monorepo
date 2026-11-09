import { BidResponsiveImg } from "@/components/media/bid-responsive-img";
import type { HomeCardImage, HomeComingUpLayout, HomeComingUpRow } from "@/lib/home-sections/types";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { bidCardSrcSet } from "@/lib/media/bid-image-src-set";
import { CoverTimeLine } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { ButtonLink } from "@auction/ui/lax";
import Link from "next/link";
import { HomeSaleRemind } from "./home-sale-remind";

type Props = {
  row: HomeComingUpRow;
  /** `feature` is the wide card for a lone sale; `card` sits in a row of two or three. */
  variant: HomeComingUpLayout;
  signedIn: boolean;
};

/**
 * The card's picture is drawn across the card: nearly half of a lone feature card from 768px, a
 * third or a half of a row of cards from 640px, the width of the page below that.
 */
const PICTURE_SIZES: Record<HomeComingUpLayout, string> = {
  feature: "(min-width: 768px) 46vw, 100vw",
  row: "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
};

function Picture({
  image,
  className,
  variant,
}: { image: HomeCardImage; className: string; variant: HomeComingUpLayout }) {
  return (
    <BidResponsiveImg
      src={image.src}
      srcSet={bidCardSrcSet(image.src)}
      sizes={PICTURE_SIZES[variant]}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn("absolute inset-0 size-full object-cover", className)}
      style={{ objectPosition: `${image.focal.x * 100}% ${image.focal.y * 100}%` }}
    />
  );
}

/**
 * One coming-up sale: its staff-chosen cover (cropped at the focal point staff set), the date,
 * how it is held, and the two actions. A sale without a cover stands on the plain surface, so
 * the card never shows an empty plate.
 */
export function HomeSaleCard({ row, variant, signedIn }: Props) {
  const feature = variant === "feature";
  return (
    <article
      data-sale-card={variant}
      className={cn(
        "flex overflow-hidden rounded-lax-card border border-border-hairline bg-surface",
        feature ? "flex-col md:flex-row" : "h-full flex-col",
        // Without a cover the card is compact, so no half of it is left empty.
        feature && !row.image && "md:max-w-[44rem]",
      )}
    >
      {row.image ? (
        <div
          className={cn(
            "relative shrink-0 overflow-hidden bg-surface-container",
            feature ? "aspect-[3/2] md:aspect-auto md:w-[46%] md:min-h-[320px]" : "aspect-[3/2]",
          )}
        >
          <Picture image={row.image} className="" variant={variant} />
        </div>
      ) : null}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-4 p-5",
          feature && "md:justify-center md:gap-5 md:p-10",
        )}
      >
        <p className="m-0 flex items-baseline gap-3">
          <span
            className={cn(
              "font-headline font-medium tabular-nums leading-none text-on-surface",
              feature ? "text-[32px] md:text-[44px]" : "text-[28px]",
            )}
          >
            {row.dateMain}
          </span>
          <span className="font-body text-[13px] leading-5 text-on-surface-variant">
            {row.dateSub}
          </span>
        </p>
        <div className="min-w-0">
          <h3
            className={cn(
              "m-0 font-headline font-medium text-on-surface",
              feature ? "text-xl leading-7 md:text-[28px] md:leading-9" : "text-lg leading-7",
            )}
          >
            <Link
              href={row.href}
              className={cn("rounded-sm underline-offset-4 hover:underline", FOCUS_RING)}
            >
              {row.title}
            </Link>
          </h3>
          <p className="m-0 mt-1 font-body text-sm leading-5 text-on-surface-variant">{row.meta}</p>
          {row.time ? (
            <p className="m-0 mt-2 font-body text-[13px] leading-5 text-on-surface-variant">
              <CoverTimeLine text={row.time.text} tick={row.time.tick} />
            </p>
          ) : null}
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
          <ButtonLink Link={Link} href={row.action.href} variant="primary">
            {row.action.label}
            <span className="sr-only"> {row.title}</span>
          </ButtonLink>
          <HomeSaleRemind saleId={row.id} saleHref={row.href} signedIn={signedIn} />
        </div>
      </div>
    </article>
  );
}
