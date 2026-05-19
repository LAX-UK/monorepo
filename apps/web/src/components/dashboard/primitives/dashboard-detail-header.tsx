import {
  type AccentTrack,
  accentEyebrowClass,
  accentLinkClass,
} from "@/lib/dashboard/accent-track";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export type DashboardDetailHeaderProps = {
  title: string;
  eyebrow?: ReactNode;
  crumbs?: ReactNode;
  backHref?: string;
  backLabel?: string;
  badges?: ReactNode;
  actions?: ReactNode;
  description?: string;
  sticky?: boolean;
  track?: AccentTrack;
  className?: string;
};

export function DashboardDetailHeader({
  title,
  eyebrow,
  crumbs,
  backHref,
  backLabel = "Back",
  badges,
  actions,
  description,
  sticky = false,
  track = "buying",
  className,
}: DashboardDetailHeaderProps) {
  return (
    <header
      className={cn(
        "z-20 -mx-4 border-b border-border-hairline bg-surface/95 px-4 py-4 backdrop-blur-sm md:-mx-8 md:px-8",
        sticky &&
          "sticky top-[var(--header-height-mobile,56px)] md:top-[var(--header-height-shell,52px)]",
        className,
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3">
        {crumbs ? <div className="text-on-surface-variant">{crumbs}</div> : null}
        {backHref && !crumbs ? (
          <Button
            variant="ghost"
            size="sm"
            asChild
            className={cn(
              "min-h-11 w-fit gap-1 px-2 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)]",
              accentLinkClass(track),
            )}
          >
            <Link href={backHref}>
              <ChevronLeft className="size-4" aria-hidden />
              {backLabel}
            </Link>
          </Button>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            {eyebrow ? (
              <p
                className={cn(
                  "font-label text-xs font-semibold uppercase tracking-[0.22em]",
                  accentEyebrowClass(track),
                )}
              >
                {eyebrow}
              </p>
            ) : null}
            <h1 className="font-headline text-2xl font-semibold tracking-tight text-on-surface sm:text-3xl">
              {title}
            </h1>
            {description ? (
              <p className="font-body text-sm text-on-surface-variant">{description}</p>
            ) : null}
            {badges ? <div className="flex flex-wrap items-center gap-2 pt-1">{badges}</div> : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
