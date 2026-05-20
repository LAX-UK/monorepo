"use client";

import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@auction/ui/components/sheet";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export type CatalogMobileAction = {
  id: string;
  label: string;
  href?: string;
  onClick?: () => void;
  /** When set, renders a native submit for that form id (cannot combine with href). */
  htmlForm?: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
};

type Props = {
  actions: readonly CatalogMobileAction[];
  className?: string;
  /** Extra padding for safe area above shell bottom nav */
  withBottomNavOffset?: boolean;
  /** Shown inline after URL actions — e.g. client publish buttons */
  trailing?: ReactNode;
};

/** Fixed bottom action bar for catalog detail/edit on mobile only. */
export function CatalogMobileActionBar({
  actions,
  className,
  withBottomNavOffset = true,
  trailing,
}: Props) {
  if (actions.length === 0 && !trailing) return null;

  const inline = actions.slice(0, 2);
  const overflow = actions.slice(2);

  return (
    <div
      className={cn(
        "fixed inset-x-0 z-30 border-t border-border-hairline bg-surface/95 p-3 backdrop-blur-md md:hidden",
        withBottomNavOffset &&
          "bottom-[calc(var(--mobile-tab-bar-height,0px)+env(safe-area-inset-bottom,0px))]",
        !withBottomNavOffset && "bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className,
      )}
      role="toolbar"
      aria-label="Page actions"
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
        {inline.map((action) => (
          <CatalogMobileActionButton key={action.id} action={action} className="flex-1" />
        ))}
        {trailing ? <div className="flex shrink-0 items-center gap-1">{trailing}</div> : null}
        {overflow.length > 0 ? (
          <Sheet>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-11 shrink-0 px-3"
              >
                <MoreHorizontal className="size-5" aria-hidden />
                <span className="sr-only">More actions</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>Actions</SheetTitle>
              </SheetHeader>
              <div className="mt-4 flex flex-col gap-2">
                {overflow.map((action) => (
                  <CatalogMobileActionButton key={action.id} action={action} className="w-full" />
                ))}
              </div>
            </SheetContent>
          </Sheet>
        ) : null}
      </div>
    </div>
  );
}

function CatalogMobileActionButton({
  action,
  className,
}: {
  action: CatalogMobileAction;
  className?: string;
}) {
  const variant = action.variant === "primary" ? "default" : "secondary";
  if (action.href) {
    return (
      <Button variant={variant} size="sm" className={cn("min-h-11", className)} asChild>
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
        className={cn("min-h-11", className)}
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
      className={cn("min-h-11", className)}
      disabled={action.disabled}
      onClick={action.onClick}
    >
      {action.label}
    </Button>
  );
}
