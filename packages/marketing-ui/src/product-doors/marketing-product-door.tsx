import { cn } from "@auction/ui";
import type { CSSProperties } from "react";
import { useId } from "react";
import { LaxLockup } from "../lax-lockup.js";
import { MarketingCardMedia } from "../marketing-card-media.js";
import { MarketingArrowUpRightIcon } from "../marketing-icons.js";
import { MediaImage } from "../media/media-image.js";
import { type MarketingProductDoorProduct, PRODUCT_DOOR_BRANDS } from "./product-door-brands.js";

type ProductDoorCopy = {
  /** What the visitor finds there, e.g. "Limited editions from our artists". */
  title: string;
  /** One specific line on why to go. */
  promise: string;
  /** Sentence-case action, e.g. "Visit LAX Shop". */
  actionLabel: string;
  /** The product's resolved storefront URL for this environment. */
  href: string;
};

/**
 * One door. A product with its own illustration may override it (a CMS image); lax.art has none
 * yet, so its door must bring an image.
 */
export type MarketingProductDoorVm =
  | (ProductDoorCopy & {
      product: Exclude<MarketingProductDoorProduct, "art">;
      imageUrl?: string | null;
    })
  | (ProductDoorCopy & { product: "art"; imageUrl: string });

type AccentStyle = CSSProperties & Record<"--door-accent" | "--door-accent-dark", string>;

export type MarketingProductDoorProps = {
  door: MarketingProductDoorVm;
  /** A lone door is wider, so its image is requested larger. */
  sizes: string;
};

/**
 * The whole card is one link to the product, named "{product}: {title}" with the promise and the
 * action as its description. The external cue (arrow) is decorative.
 */
export function MarketingProductDoor({ door, sizes }: MarketingProductDoorProps) {
  const brand = PRODUCT_DOOR_BRANDS[door.product];
  const promiseId = useId();
  const actionId = useId();
  const imageSrc = door.imageUrl?.trim() || brand.illustration?.src || null;
  const usesIllustration = imageSrc === brand.illustration?.src;
  const accentStyle: AccentStyle | undefined = brand.accent
    ? { "--door-accent": brand.accent.light, "--door-accent-dark": brand.accent.dark }
    : undefined;

  return (
    <a
      href={door.href}
      aria-label={`${brand.name}: ${door.title}`}
      aria-describedby={`${promiseId} ${actionId}`}
      data-product={door.product}
      style={accentStyle}
      className={cn(
        "group flex h-full w-full flex-col text-on-surface",
        // The lockup tag takes this door's product accent, never the host's.
        "[--color-product-accent:var(--door-accent)] dark:[--color-product-accent:var(--door-accent-dark)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
        "motion-safe:transition-opacity motion-safe:duration-150 active:opacity-80",
      )}
    >
      <MarketingCardMedia className="aspect-[3/2] bg-surface-container md:aspect-[4/3]">
        <MediaImage
          src={imageSrc}
          alt=""
          label={brand.name}
          sizes={sizes}
          className="absolute inset-0 size-full"
          imgClassName={cn(
            "object-cover",
            usesIllustration ? brand.illustration?.objectPositionClassName : null,
          )}
        />
        {/* A hairline keeps the art from floating on dark surfaces. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_var(--color-outline-variant)] hidden dark:block"
        />
      </MarketingCardMedia>
      <div className="flex flex-1 flex-col pt-5 md:pt-6">
        <span aria-hidden className="flex h-9 items-center md:h-10">
          <LaxLockup kind={brand.lockup} className="block h-full w-auto" />
        </span>
        <h3 className="m-0 mt-4 font-headline text-2xl font-medium leading-[1.25] text-balance md:text-[1.75rem]">
          <span className="underline decoration-transparent decoration-1 underline-offset-[6px] motion-safe:transition-[text-decoration-color] motion-safe:duration-200 group-hover:decoration-[var(--color-product-accent,currentColor)]">
            {door.title}
          </span>
        </h3>
        <p
          id={promiseId}
          className="m-0 mt-2 max-w-[60ch] font-supporting text-base leading-6 text-on-surface-variant"
        >
          {door.promise}
        </p>
        <span
          id={actionId}
          className="mt-auto inline-flex items-center gap-1.5 self-start pt-4 font-supporting text-base font-medium"
        >
          <span className="underline decoration-1 underline-offset-4 group-hover:decoration-2">
            {door.actionLabel}
          </span>
          <MarketingArrowUpRightIcon className="size-4 motion-safe:transition-transform motion-safe:duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </span>
      </div>
    </a>
  );
}
