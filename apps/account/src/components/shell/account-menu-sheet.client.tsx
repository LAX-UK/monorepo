"use client";

import type { AccountNavItemVm } from "@/server/domain/account-nav.vm";
import type { LaxFamilyLinkVm } from "@auction/lax-ecosystem";
import {
  LaxFamilyMenuLinks,
  MarketingChromeIconButton,
  MarketingMenuIcon,
} from "@auction/marketing-ui";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@auction/ui/components/sheet";
import { useEffect, useRef, useState } from "react";
import { AccountAvatar } from "./account-avatar";
import { OPEN_ACCOUNT_MENU_EVENT } from "./account-menu-events";
import { AccountNav } from "./account-nav.client";
import type { AccountViewer } from "./account-viewer";
import { SignOutForm } from "./sign-out-form";

/**
 * The phone version of the left menu: a sheet opened from the header. It holds the person, the
 * same seven destinations, the other LAX products (the product bar is hidden on a phone) and
 * Sign out. It closes when a destination is chosen.
 */
export function AccountMenuSheet({
  viewer,
  items,
  products,
}: {
  viewer: AccountViewer;
  items: AccountNavItemVm[];
  products: LaxFamilyLinkVm[];
}) {
  const [open, setOpen] = useState(false);
  // The tab bar's More button, when it opened the sheet: focus goes back to it on close, not to
  // the header button (the bar is inert while the sheet is open, so Radix cannot restore it).
  const openedFrom = useRef<HTMLElement | null>(null);
  // The phone tab bar's More tab opens this same sheet.
  useEffect(() => {
    const show = () => {
      openedFrom.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    };
    window.addEventListener(OPEN_ACCOUNT_MENU_EVENT, show);
    return () => window.removeEventListener(OPEN_ACCOUNT_MENU_EVENT, show);
  }, []);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <MarketingChromeIconButton label="Open menu" className="lg:hidden">
          <MarketingMenuIcon />
        </MarketingChromeIconButton>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex w-[min(85vw,22rem)] flex-col gap-6 overflow-y-auto bg-surface"
        onCloseAutoFocus={(event) => {
          const target = openedFrom.current;
          openedFrom.current = null;
          if (!target?.isConnected) return;
          event.preventDefault();
          // The bar stops being inert on the next frame, after the sheet has gone.
          requestAnimationFrame(() => target.focus());
        }}
      >
        <div className="flex items-center gap-3 pr-10">
          <AccountAvatar viewer={viewer} className="size-11" textClassName="text-sm" />
          <div className="min-w-0">
            <SheetTitle className="truncate text-sm">{viewer.displayName}</SheetTitle>
            <SheetDescription className="truncate text-xs">
              {viewer.name && viewer.email ? viewer.email : "LAX Account"}
            </SheetDescription>
          </div>
        </div>
        <AccountNav items={items} onNavigate={() => setOpen(false)} />
        <LaxFamilyMenuLinks
          links={products}
          onNavigate={() => setOpen(false)}
          className="border-t border-border-hairline px-3 pt-4"
        />
        <SignOutForm className="mt-auto" />
      </SheetContent>
    </Sheet>
  );
}
