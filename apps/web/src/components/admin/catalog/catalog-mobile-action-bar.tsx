"use client";

import { cn } from "@auction/ui";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetTrigger,
} from "@auction/ui/components/bottom-sheet";
import { Button } from "@auction/ui/components/button";
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { CatalogMobileAction } from "@/lib/admin/catalog/types";

export type { CatalogMobileAction };

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
        "fixed inset-x-0 z-30 border-t border-border-hairline bg-surface/95 p-3 backdrop-blur-md lg:hidden",
        withBottomNavOffset &&
          "bottom-[calc(var(--mobile-tab-bar-height,0px)+env(safe-area-inset-bottom,0px))]",
        !withBottomNavOffset && "bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className,
      )}
      role="toolbar"
      aria-label="Page actions"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {inline.map((action) => (
            <CatalogMobileActionButton key={action.id} action={action} className="min-w-0 flex-1" />
          ))}
        </div>
        {trailing ? <div className="flex shrink-0 items-center gap-1">{trailing}</div> : null}
        {overflow.length > 0 ? (
          <BottomSheet>
            <BottomSheetTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-11 shrink-0 px-3"
              >
                <MoreHorizontal className="size-5" aria-hidden />
                <span className="sr-only">More actions</span>
              </Button>
            </BottomSheetTrigger>
            <BottomSheetContent className="rounded-t-2xl">
              <BottomSheetHeader className="px-6 pt-0 text-left">
                <BottomSheetTitle>Actions</BottomSheetTitle>
              </BottomSheetHeader>
              <div className="flex flex-col gap-2 px-6 pb-6">
                {overflow.map((action) => (
                  <CatalogMobileActionButton key={action.id} action={action} className="w-full" />
                ))}
              </div>
            </BottomSheetContent>
          </BottomSheet>
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
  if (action.disabled && action.href) {
    return (
      <Button variant={variant} size="sm" className={cn("min-h-11", className)} disabled>
        {action.label}
      </Button>
    );
  }
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
