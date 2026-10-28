"use client";

import type { SessionUser } from "@/lib/data/contracts";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@auction/ui/components/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { AccountMenuIdentity } from "./account-menu-identity";

type AccountMenuSheetProps = {
  user: SessionUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

/**
 * The phone account sheet opened from the avatar: who is signed in, then the account menu only.
 * The site menu stays on the menu button, so this sheet stays short.
 */
export function AccountMenuSheet({ user, open, onOpenChange, children }: AccountMenuSheetProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[var(--z-overlay,60)]"
        closeClassName="hidden"
        className={cn(
          "fixed inset-y-0 top-0 right-0 left-auto z-[var(--z-overlay,60)] !flex h-full max-h-[100dvh] w-[min(100vw-3rem,24rem)] max-w-sm translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-l border-border-hairline bg-surface p-0 shadow-xl sm:max-w-sm sm:rounded-none sm:p-0",
        )}
      >
        <DialogTitle className="sr-only">Your account</DialogTitle>
        <DialogDescription className="sr-only">Your Bid pages and accounts</DialogDescription>
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant/60 py-3 pr-3 pl-4">
          <AccountMenuIdentity user={user} />
          <DialogClose
            className={cn(
              "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-on-surface transition-colors hover:bg-surface-container-low",
              FOCUS_RING,
            )}
            aria-label="Close account menu"
          >
            <X className="size-5" aria-hidden />
          </DialogClose>
        </div>
        <nav aria-label="Your account" className="px-2 pb-6">
          {children}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
