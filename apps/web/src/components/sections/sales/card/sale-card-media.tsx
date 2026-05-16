import { SaleStatusBadge } from "@/components/marketing/sale-status-badge";
import type { SaleCardMediaProps } from "@/components/sections/sales/card/types";
import { MediaImage } from "@/components/ui/media-image";
import { cn } from "@auction/ui";
import Link from "next/link";

const DEFAULT_SIZES = "(max-width: 1024px) 100vw, 420px";

export function SaleCardMedia({
  href,
  coverImageUrl,
  coverImageAlt,
  countdownEndIso,
  isLive,
  sizes = DEFAULT_SIZES,
  className,
  linkMode = "area",
  imageRoundedClassName = "rounded-md",
  scrimClassName = "bg-black/10",
  layout = "calendarRow",
}: SaleCardMediaProps) {
  const imageBlock = (
    <>
      <MediaImage
        src={coverImageUrl}
        alt={coverImageAlt}
        label="Auction cover"
        className="absolute inset-0 size-full"
        imgClassName={cn(
          "size-full object-cover transition-transform duration-700 ease-out",
          "motion-safe:group-hover/image:scale-[1.03] motion-reduce:group-hover/image:scale-100",
        )}
        sizes={sizes}
      />
      {scrimClassName ? (
        <div className={cn("pointer-events-none absolute inset-0", scrimClassName)} aria-hidden />
      ) : null}
      {isLive && countdownEndIso ? <SaleStatusBadge countdownEndIso={countdownEndIso} /> : null}
    </>
  );

  const layoutClass =
    layout === "featured"
      ? "aspect-[16/10] w-full lg:aspect-[16/9]"
      : "aspect-[16/10] w-full shrink-0 lg:h-[280px] lg:w-[min(100%,420px)] lg:max-w-[420px] lg:aspect-auto";

  return (
    <div
      className={cn(
        "group/image relative overflow-hidden bg-surface-container",
        layoutClass,
        imageRoundedClassName,
        className,
      )}
    >
      {linkMode === "area" ? (
        <Link
          href={href}
          className="absolute inset-0 block"
          aria-label={`View images for ${coverImageAlt}`}
        >
          {imageBlock}
        </Link>
      ) : (
        <div className="absolute inset-0">{imageBlock}</div>
      )}
    </div>
  );
}
