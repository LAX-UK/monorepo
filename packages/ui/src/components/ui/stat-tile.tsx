import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils.js";

export type StatTileProps = HTMLAttributes<HTMLDivElement> & {
  label: string;
  value: string;
  /** Use `dark` when placed on a dark scrim over imagery */
  tone?: "light" | "dark";
};

export function StatTile({ label, value, tone = "dark", className = "", ...rest }: StatTileProps) {
  const isDark = tone === "dark";
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-2 border-l-2 border-accent-gold pl-4", className)}
      {...rest}
    >
      <span
        className={cn(
          "font-label text-[13px] font-medium uppercase leading-4",
          isDark ? "text-brand-100" : "text-on-surface-variant",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-headline text-2xl font-normal leading-none tracking-[-0.96px] md:text-[28px]",
          isDark ? "text-hero-foreground" : "text-on-surface",
        )}
      >
        {value}
      </span>
    </div>
  );
}
