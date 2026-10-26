"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@auction/ui";
import { type ReactNode, useRef } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  preview?: ReactNode;
  children: ReactNode;
};

/** Responsive inspector for editing one media item without cluttering the gallery grid. */
export function CatalogMediaInspector({
  open,
  onOpenChange,
  title,
  description,
  preview,
  children,
}: Props) {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-y-auto border-border-hairline sm:max-w-md"
        onOpenAutoFocus={() => {
          returnFocusRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          if (!returnFocusRef.current?.isConnected) return;
          event.preventDefault();
          returnFocusRef.current.focus();
        }}
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-headline text-lg text-on-surface">{title}</SheetTitle>
          {description ? (
            <SheetDescription className="font-body text-sm">{description}</SheetDescription>
          ) : null}
        </SheetHeader>
        {preview ? <div className="mt-4 overflow-hidden rounded-shell-card">{preview}</div> : null}
        <div className="mt-6 space-y-4 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
