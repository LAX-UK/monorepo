import { SITE_SHORT_NAME } from "@/lib/brand";
import type { ReactNode } from "react";

type LaxLogoProps = {
  /** "header" = compact nav bar; "footer" = larger mark */
  variant?: "header" | "footer";
  className?: string;
  /** Optional image (e.g. `/brand/logo.png`) — otherwise typeset stack */
  imageSrc?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  /** Extra content after the wordmark (e.g. Next Image) */
  children?: ReactNode;
};

export function LaxLogo({
  variant = "header",
  className = "",
  imageSrc,
  imageAlt = `${SITE_SHORT_NAME} London Auction House`,
  imageWidth = 201,
  imageHeight = 44,
  children,
}: LaxLogoProps) {
  const titleSize = variant === "footer" ? "text-4xl md:text-5xl" : "text-2xl md:text-3xl";
  const subSize = variant === "footer" ? "text-[11px] md:text-xs" : "text-[9px] md:text-[10px]";

  if (imageSrc) {
    return (
      <div className={`flex flex-col ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- optional static asset from /public */}
        <img
          src={imageSrc}
          alt={imageAlt}
          width={imageWidth}
          height={imageHeight}
          className="h-auto w-auto max-w-[201px]"
        />
        {children}
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      <span
        className={`font-headline font-semibold uppercase leading-none tracking-tight text-brand-900 ${titleSize}`}
      >
        {SITE_SHORT_NAME}
      </span>
      <span
        className={`font-label font-semibold uppercase tracking-[0.28em] text-brand-900 ${subSize} mt-1`}
      >
        London Auction House Ltd
      </span>
      {children}
    </div>
  );
}
