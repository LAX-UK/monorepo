"use client";

import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { CatalogMobileAction } from "./catalog-mobile-action-bar";

export type CatalogMobileActionsPlacement = "header" | "bar" | "none";

type Props = {
  title: ReactNode;
  description?: string;
  meta?: ReactNode;
  breadcrumbs?: ReactNode;
  eyebrow?: ReactNode;
  /** Shown on md+ in the header row */
  actions?: ReactNode;
  /** Primary + overflow on mobile — rendered per `mobileActionsPlacement` */
  mobileActions?: readonly CatalogMobileAction[];
  /** Where mobile actions render; default `none` (shells use fixed bottom bar). */
  mobileActionsPlacement?: CatalogMobileActionsPlacement;
  className?: string;
};

/** Non-sticky catalog page header — content-first, mobile stacked. */
export function CatalogPageHeader({
  title,
  description,
  meta,
  breadcrumbs,
  eyebrow,
  actions,
  mobileActions,
  mobileActionsPlacement = "none",
  className,
}: Props) {
  const primaryMobile = mobileActions?.find((a) => a.variant === "primary") ?? mobileActions?.[0];
  const overflowMobile = mobileActions?.filter((a) => a.id !== primaryMobile?.id) ?? [];
  const showHeaderMobile =
    mobileActionsPlacement === "header" && mobileActions && mobileActions.length > 0;

  return (
    <header className={cn("mx-auto w-full max-w-7xl", className)}>
      {breadcrumbs ? (
        <div className="mb-4 text-sm text-on-surface-variant [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline">
          {breadcrumbs}
        </div>
      ) : null}
      {eyebrow ? (
        <p className="mb-2 font-label text-[10px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
          {eyebrow}
        </p>
      ) : null}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-8">
        <div className="min-w-0 flex-1">
          {meta ? <div className="mb-2">{meta}</div> : null}
          <h1 className="font-headline text-2xl font-semibold tracking-tight text-on-surface md:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed text-on-surface-variant">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="hidden shrink-0 flex-wrap items-center gap-2 md:flex">{actions}</div>
        ) : null}
        {showHeaderMobile ? (
          <div className="flex flex-wrap items-center gap-2 md:hidden">
            {primaryMobile ? <CatalogHeaderActionButton action={primaryMobile} fullWidth /> : null}
            {overflowMobile.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="secondary" size="sm" className="min-h-11">
                    <MoreHorizontal className="size-4" aria-hidden />
                    <span className="sr-only">More actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {overflowMobile.map((action) => (
                    <DropdownMenuItem
                      key={action.id}
                      asChild={Boolean(action.href || action.htmlForm)}
                      {...(action.disabled === true ? { disabled: true } : {})}
                    >
                      {action.href ? (
                        <Link href={action.href}>{action.label}</Link>
                      ) : action.htmlForm ? (
                        <button type="submit" form={action.htmlForm}>
                          {action.label}
                        </button>
                      ) : (
                        <button type="button" onClick={action.onClick}>
                          {action.label}
                        </button>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}

function CatalogHeaderActionButton({
  action,
  fullWidth,
}: {
  action: CatalogMobileAction;
  fullWidth?: boolean;
}) {
  const variant = action.variant === "primary" ? "default" : "secondary";
  if (action.disabled && action.href) {
    return (
      <Button
        variant={variant}
        size="sm"
        className={fullWidth ? "min-h-11 flex-1" : "min-h-11"}
        disabled
      >
        {action.label}
      </Button>
    );
  }
  if (action.href) {
    return (
      <Button
        variant={variant}
        size="sm"
        className={fullWidth ? "min-h-11 flex-1" : "min-h-11"}
        asChild
      >
        <Link href={action.href}>{action.label}</Link>
      </Button>
    );
  }
  if (action.htmlForm) {
    return (
      <Button
        type="submit"
        form={action.htmlForm}
        variant={variant}
        size="sm"
        className={fullWidth ? "min-h-11 flex-1" : "min-h-11"}
        disabled={action.disabled}
      >
        {action.label}
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      className={fullWidth ? "min-h-11 flex-1" : "min-h-11"}
      disabled={action.disabled}
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  );
}
