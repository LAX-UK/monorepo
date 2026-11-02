import { BACK_LINK_CLASS, EYEBROW_CLASS } from "@/lib/dashboard/accent-track";
import { cn } from "@auction/ui";
import { Button, pageTitleClass } from "@auction/ui/lax";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export type DashboardDetailHeaderProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  crumbs?: ReactNode;
  backHref?: string;
  backLabel?: string;
  badges?: ReactNode;
  actions?: ReactNode;
  description?: string;
  sticky?: boolean;
  /** Hide back/title on mobile — shell MobileShellTitle owns navigation. */
  compactOnMobile?: boolean;
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
  compactOnMobile = false,
  className,
}: DashboardDetailHeaderProps) {
  const compact = compactOnMobile;
  const mobileHidden = compact && !crumbs;

  return (
    <header
      className={cn(
        "z-20 -mx-4 border-b border-border-hairline bg-surface/95 px-4 py-4 backdrop-blur-sm lg:-mx-8 lg:px-8",
        mobileHidden && "hidden lg:block",
        sticky &&
          !compact &&
          "sticky top-[var(--header-height-mobile,56px)] lg:top-[var(--header-height-shell,52px)]",
        sticky && compact && "lg:sticky lg:top-[var(--header-height-shell,52px)]",
        className,
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3">
        {crumbs ? <div className="text-on-surface-variant">{crumbs}</div> : null}
        {backHref && !crumbs ? (
          <Button
            variant="ghost"
            size="md"
            asChild
            className={cn("w-fit", BACK_LINK_CLASS, compact && "hidden lg:inline-flex")}
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
              <p className={cn(EYEBROW_CLASS, compact && "hidden lg:block")}>{eyebrow}</p>
            ) : null}
            {compact ? (
              <h1 className={cn(pageTitleClass, "hidden lg:block")}>{title}</h1>
            ) : (
              <h1 className={pageTitleClass}>{title}</h1>
            )}
            {description ? (
              <p
                className={cn(
                  "font-body text-sm text-on-surface-variant",
                  compact && "hidden lg:block",
                )}
              >
                {description}
              </p>
            ) : null}
            {badges ? (
              <div
                className={cn(
                  "flex flex-wrap items-center gap-2 pt-1",
                  compact && "hidden lg:flex",
                )}
              >
                {badges}
              </div>
            ) : null}
          </div>
          {actions ? (
            <div
              className={cn(
                "flex shrink-0 flex-wrap items-center gap-2",
                compact && "hidden lg:flex",
              )}
            >
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
