"use client";

import { shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { FOCUS_RING } from "@auction/branding";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import {
  MARKETING_HEADER_CHROME,
  MarketingChevronDownIcon,
  type MarketingHeaderTone,
  MarketingUserIcon,
  headerChromeIconClass,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";

const ORDERS_HREF = "/account/orders";

function accountInitials(displayName: string, email: string): string {
  const source = displayName.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  const fromEmail = email[0] ?? "";
  return (first + second).toUpperCase() || fromEmail.toUpperCase() || "?";
}

function menuItemClass(headerTone: MarketingHeaderTone): string {
  return cn(
    "min-h-11 cursor-pointer font-label text-sm font-medium uppercase tracking-wide",
    headerTone === "on-dark"
      ? "text-brand-900 focus:bg-page-bg"
      : "text-brand-900 focus:bg-page-bg dark:text-on-surface dark:focus:bg-surface-container-low",
  );
}

type ShopGuestAccountMenuProps = {
  loginHref: string;
  registerHref: string;
  headerTone: MarketingHeaderTone;
  onNavigate?: () => void;
  initialOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function ShopGuestAccountMenu({
  loginHref: _loginHref,
  registerHref,
  headerTone,
  onNavigate,
  initialOpen = false,
  open,
  onOpenChange,
}: ShopGuestAccountMenuProps) {
  const pathname = usePathname();
  const loginHref = shopStorefrontLoginHref(pathname || "/");
  const menuProps =
    open !== undefined && onOpenChange
      ? { open, onOpenChange }
      : { defaultOpen: initialOpen, ...(onOpenChange ? { onOpenChange } : {}) };
  return (
    <DropdownMenu {...menuProps}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative flex shrink-0 items-center gap-1 rounded-sm",
            FOCUS_RING,
            headerTone === "on-dark"
              ? "text-hero-foreground"
              : "text-brand-900 dark:text-on-surface",
          )}
          aria-label="Account menu"
        >
          <span
            className={cn(
              "inline-flex min-h-[44px] min-w-[44px] items-center justify-center",
              headerChromeIconClass(headerTone),
            )}
          >
            <MarketingUserIcon />
          </span>
          <span
            className={cn(
              MARKETING_HEADER_CHROME,
              "hidden font-label text-xs font-medium uppercase tracking-[0.18em] xl:inline",
              headerTone === "on-dark" ? "text-hero-foreground/85" : "text-on-surface-variant",
            )}
          >
            Account
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(100vw-2rem,16rem)] p-0">
        <div className="border-b border-nav-border px-3 py-2.5 dark:border-border-hairline">
          <p className="font-body text-sm font-medium text-brand-900 dark:text-on-surface">
            Your account
          </p>
          <p className="mt-1 font-body text-xs leading-relaxed text-brand-400 dark:text-on-surface-variant">
            Sign in to save your basket, track orders, and manage your account.
          </p>
        </div>
        <div className="flex flex-col gap-1 px-2 py-2">
          <DropdownMenuItem asChild className={menuItemClass(headerTone)}>
            <Link href={loginHref} {...(onNavigate ? { onClick: onNavigate } : {})}>
              Sign in
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
            <Link
              href={registerHref}
              className={cn(
                "inline-flex min-h-11 w-full items-center justify-center rounded bg-cta-bg px-3 py-2 text-center font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on transition-opacity hover:opacity-95",
                FOCUS_RING,
              )}
              {...(onNavigate ? { onClick: onNavigate } : {})}
            >
              Create account
            </Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type ShopAuthenticatedAccountMenuProps = {
  displayName: string;
  email: string;
  accountHref: string;
  logoutHref: string;
  productLinks: LaxProductLinkVm[];
  headerTone: MarketingHeaderTone;
  onNavigate?: () => void;
  initialOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function ShopAuthenticatedAccountMenu({
  displayName,
  email,
  accountHref,
  logoutHref,
  productLinks,
  headerTone,
  onNavigate,
  initialOpen = false,
  open,
  onOpenChange,
}: ShopAuthenticatedAccountMenuProps) {
  const otherProducts = productLinks.filter((link) => !link.current);
  const initials = accountInitials(displayName, email);
  const signOutFormRef = useRef<HTMLFormElement>(null);
  const menuProps =
    open !== undefined && onOpenChange
      ? { open, onOpenChange }
      : { defaultOpen: initialOpen, ...(onOpenChange ? { onOpenChange } : {}) };

  return (
    <>
      <form ref={signOutFormRef} action={logoutHref} method="post" hidden />
      <DropdownMenu {...menuProps}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "group h-auto max-w-[200px] justify-start gap-2 bg-transparent py-1 pl-1 pr-2 text-left",
              headerTone === "on-dark"
                ? "text-hero-foreground hover:bg-hero-foreground/10"
                : "hover:bg-page-bg dark:hover:bg-surface-container-low",
            )}
            aria-label="Account menu"
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-label text-xs font-semibold uppercase",
                headerTone === "on-dark"
                  ? "bg-hero-foreground/15 text-hero-foreground"
                  : "bg-surface-container-high text-brand-900 dark:text-on-surface",
              )}
              aria-hidden
            >
              {initials}
            </span>
            <span
              className={cn(
                "hidden min-w-0 truncate font-label text-sm font-medium uppercase leading-tight sm:inline",
                headerTone === "on-dark"
                  ? "text-hero-foreground"
                  : "text-brand-900 dark:text-on-surface",
              )}
            >
              {displayName}
            </span>
            <MarketingChevronDownIcon
              className={cn(
                "shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180",
                headerTone === "on-dark"
                  ? "text-hero-foreground"
                  : "text-brand-900 dark:text-on-surface",
              )}
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[min(100vw-2rem,16rem)] p-0">
          <div className="border-b border-nav-border px-3 py-2 dark:border-border-hairline">
            <p className="truncate font-body text-sm font-medium text-brand-900 dark:text-on-surface">
              {displayName}
            </p>
            {email ? (
              <p className="mt-0.5 truncate font-body text-xs text-brand-400 dark:text-on-surface-variant">
                {email}
              </p>
            ) : null}
          </div>
          <div className="py-1">
            {otherProducts.length > 0 ? (
              <>
                <DropdownMenuLabel className="px-3 py-1.5 font-label text-[10px] font-bold uppercase tracking-[0.12em] text-brand-400 dark:text-on-surface-variant">
                  LAX products
                </DropdownMenuLabel>
                {otherProducts.map((item) => (
                  <DropdownMenuItem key={item.id} asChild className={menuItemClass(headerTone)}>
                    <a
                      href={item.href}
                      rel="noopener noreferrer"
                      {...(onNavigate ? { onClick: onNavigate } : {})}
                    >
                      {item.label}
                    </a>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem asChild className={menuItemClass(headerTone)}>
              <Link href={accountHref} {...(onNavigate ? { onClick: onNavigate } : {})}>
                My account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className={menuItemClass(headerTone)}>
              <Link href={ORDERS_HREF} {...(onNavigate ? { onClick: onNavigate } : {})}>
                Orders
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className={menuItemClass(headerTone)}
              onSelect={(event) => {
                event.preventDefault();
                signOutFormRef.current?.requestSubmit();
              }}
            >
              Sign out
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
