import type { HTMLAttributes } from "react";
import { cn } from "../../lib/utils.js";

export type StatTileProps = HTMLAttributes<HTMLDivElement> & {
  label: string;
  value: string;
  /** `dark` / `white`: scrim over imagery; `light`: on surface */
  tone?: "light" | "dark" | "white";
};

export function StatTile({ label, value, tone = "dark", className = "", ...rest }: StatTileProps) {
  const labelClass =
    tone === "dark"
      ? "text-brand-100"
      : tone === "white"
        ? "text-white/80"
        : "text-on-surface-variant";
  const valueClass =
    tone === "dark" ? "text-hero-foreground" : tone === "white" ? "text-white" : "text-on-surface";
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-2 border-l-2 border-accent-gold pl-4", className)}
      {...rest}
    >
      <span className={cn("font-label text-[13px] font-medium uppercase leading-4", labelClass)}>
        {label}
      </span>
      <span
        className={cn(
          "font-headline text-2xl font-normal leading-none tracking-[-0.96px] md:text-[28px]",
          valueClass,
        )}
      >
        {value}
      </span>
    </div>
  );
}
