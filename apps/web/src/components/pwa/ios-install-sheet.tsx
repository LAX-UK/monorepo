"use client";

import { Button } from "@auction/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@auction/ui/components/sheet";
import { Share } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Instructions for adding the site to the iOS home screen (required for Safari web push). */
export function IosInstallSheet({ open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Add LAX to your home screen</SheetTitle>
          <SheetDescription>
            On iPhone and iPad, browser push alerts only work when you open LAX from your home
            screen.
          </SheetDescription>
        </SheetHeader>
        <ol className="mt-4 space-y-3 font-body text-sm text-on-surface">
          <li className="flex items-start gap-3">
            <Share className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              Tap <strong>Share</strong> in Safari (or your browser menu).
            </span>
          </li>
          <li>
            Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
          </li>
          <li>
            Open LAX from the new icon on your home screen, then return here to enable push alerts.
          </li>
        </ol>
        <Button type="button" className="mt-6 w-full" onClick={() => onOpenChange(false)}>
          Got it
        </Button>
      </SheetContent>
    </Sheet>
  );
}
