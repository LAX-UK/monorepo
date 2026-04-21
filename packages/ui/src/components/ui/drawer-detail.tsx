"use client";

import type * as React from "react";
import { cn } from "../../lib/utils.js";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "./sheet.js";

export type DrawerDetailProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  side?: "right" | "left" | "top" | "bottom";
  className?: string;
};

export function DrawerDetail({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = "right",
  className,
}: DrawerDetailProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          "flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg",
          className,
        )}
      >
        <SheetHeader className="border-b border-outline-variant/15 pb-4 text-left">
          <SheetTitle className="font-headline text-xl text-on-surface">{title}</SheetTitle>
          {description ? (
            <SheetDescription className="text-left text-on-surface-variant">
              {description}
            </SheetDescription>
          ) : null}
        </SheetHeader>
        <div className="flex-1 py-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
