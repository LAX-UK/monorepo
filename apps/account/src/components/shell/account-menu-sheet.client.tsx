"use client";

import type { AccountNavItemVm, ProductBarItemVm } from "@/server/domain/account-nav.vm";
import { MarketingChromeIconButton, MarketingMenuIcon } from "@auction/marketing-ui";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@auction/ui/components/sheet";
import { useState } from "react";
import { AccountAvatar } from "./account-avatar";
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
  products: ProductBarItemVm[];
}) {
  const [open, setOpen] = useState(false);
  const otherProducts = products.filter((product) => !product.current);
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
        {otherProducts.length > 0 ? (
          <nav
            aria-label="LAX products"
            className="flex flex-col gap-1 border-t border-border-hairline pt-4"
          >
            <p className="px-3 pb-1 font-label text-xs uppercase tracking-[0.22em] text-on-surface-variant">
              LAX products
            </p>
            {otherProducts.map((product) => (
              <a
                key={product.id}
                href={product.href}
                className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              >
                {product.label}
              </a>
            ))}
          </nav>
        ) : null}
        <SignOutForm className="mt-auto" />
      </SheetContent>
    </Sheet>
  );
}
