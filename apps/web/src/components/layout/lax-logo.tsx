import { SITE_LOGO_PATH, SITE_SHORT_NAME } from "@/lib/brand";
import { cn } from "@auction/ui";
import Image from "next/image";
import type { ReactNode } from "react";

type LaxLogoProps = {
  /** "header" = compact nav bar; "footer" = larger mark; "auth" = centered sign-in/up */
  variant?: "header" | "footer" | "auth";
  className?: string;
  /** Logo URL from `/public`. Omit to use `SITE_LOGO_PATH`.
   * Pass `""` to force the typeset wordmark (no image).
   */
  imageSrc?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  /** Hide the tagline subline when using the typeset wordmark. */
  hideTagline?: boolean;
  children?: ReactNode;
};

export function LaxLogo({
  variant = "header",
  className = "",
  imageSrc,
  imageAlt = `${SITE_SHORT_NAME} London Auction House`,
  imageWidth = 660,
  imageHeight = 200,
  hideTagline = false,
  children,
}: LaxLogoProps) {
  const titleSize =
    variant === "footer"
      ? "text-4xl md:text-5xl"
      : variant === "auth"
        ? "text-3xl md:text-4xl"
        : "text-2xl md:text-3xl";
  const subSize =
    variant === "footer"
      ? "text-[11px] md:text-xs"
      : variant === "auth"
        ? "text-[10px] md:text-[11px]"
        : "text-[9px] md:text-[10px]";
  const src = imageSrc === "" ? null : (imageSrc ?? SITE_LOGO_PATH);
  const imgMax =
    variant === "footer"
      ? "max-h-[60px] max-w-[min(100%,320px)]"
      : variant === "auth"
        ? "max-h-[98px] max-w-[min(100%,512px)]"
        : "max-h-9 max-w-[140px] sm:max-h-11 sm:max-w-[201px]";
  const shellClassName = cn("flex flex-col", variant === "auth" && "items-center", className);

  if (src) {
    return (
      <div className={shellClassName}>
        <Image
          src={src}
          alt={imageAlt}
          width={imageWidth}
          height={imageHeight}
          unoptimized={src.endsWith(".svg")}
          className={cn(
            "h-auto w-auto motion-reduce:transition-none dark:brightness-0 dark:invert",
            imgMax,
          )}
          priority={variant === "header"}
        />
        {children}
      </div>
    );
  }

  return (
    <div className={shellClassName}>
      <span
        className={`font-headline font-semibold uppercase leading-none tracking-tight text-brand-900 dark:text-inverse-on-surface ${titleSize}`}
      >
        {SITE_SHORT_NAME}
      </span>
      {!hideTagline ? (
        <span
          className={`font-label font-semibold uppercase tracking-[0.28em] text-accent-brand ${subSize} mt-1`}
        >
          London Auction House Ltd
        </span>
      ) : null}
      {children}
    </div>
  );
}
