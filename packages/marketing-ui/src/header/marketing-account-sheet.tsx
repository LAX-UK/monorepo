"use client";

import { cn } from "@auction/ui";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@auction/ui/components/sheet";
import type { ReactNode } from "react";

export type MarketingAccountSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Heading, e.g. the person's name or "Account". */
  title: string;
  description?: string;
  /** The product's account menu rows. */
  children: ReactNode;
  className?: string;
};

/**
 * The account menu as a right-hand sheet for tablet widths (768-1023px), where the dropdown has
 * too little room. Rows are supplied by the product. Being a modal, it hides the bottom bar.
 */
export function MarketingAccountSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: MarketingAccountSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-testid="account-sheet"
        className={cn("w-[min(100vw-3rem,22rem)] overflow-y-auto bg-surface p-0", className)}
      >
        <SheetHeader className="border-b border-nav-border px-6 py-5 text-left">
          <SheetTitle className="font-label text-base font-semibold text-on-surface">
            {title}
          </SheetTitle>
          <SheetDescription className={description ? "text-sm" : "sr-only"}>
            {description ?? "Account menu"}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-1 px-6 py-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
