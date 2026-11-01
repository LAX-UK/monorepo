"use client";

import { FOCUS_RING } from "@auction/branding";
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
import { type ReactNode, useRef } from "react";
import { accountTriggerName } from "./account-display-name.js";
import { MARKETING_HEADER_CHROME, type MarketingHeaderTone } from "./header/header-chrome-tone.js";
import { MarketingChromeIconButton } from "./header/marketing-chrome-icon-button.js";
import { MarketingChevronDownIcon, MarketingUserIcon } from "./marketing-icons.js";

export type MarketingAccountNavItem = {
  href: string;
  label: string;
  external?: boolean;
};

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
    "min-h-11 cursor-pointer font-label text-sm font-medium",
    headerTone === "on-dark"
      ? "text-brand-900 focus:bg-page-bg"
      : "text-brand-900 focus:bg-page-bg dark:text-on-surface dark:focus:bg-surface-container-low",
  );
}

export type MarketingGuestAccountMenuProps = {
  loginHref: string;
  registerHref: string;
  headerTone: MarketingHeaderTone;
  loginLabel?: string;
  registerLabel?: string;
  renderLoginLink?: (props: { href: string; className: string; children: ReactNode }) => ReactNode;
  renderRegisterLink?: (props: {
    href: string;
    className: string;
    children: ReactNode;
  }) => ReactNode;
  onNavigate?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function MarketingGuestAccountMenu({
  loginHref,
  registerHref,
  headerTone,
  loginLabel = "Sign in",
  registerLabel = "Create account",
  renderLoginLink,
  renderRegisterLink,
  open,
  onOpenChange,
}: MarketingGuestAccountMenuProps) {
  const menuProps =
    open !== undefined && onOpenChange
      ? { open, onOpenChange }
      : { ...(onOpenChange ? { onOpenChange } : {}) };

  const loginLink = renderLoginLink ?? ((props) => <Link {...props} />);
  const registerLink = renderRegisterLink ?? ((props) => <Link {...props} />);

  return (
    <DropdownMenu {...menuProps}>
      <DropdownMenuTrigger asChild>
        <MarketingChromeIconButton label="Account menu" className="gap-1 xl:pr-1">
          <MarketingUserIcon />
          <span
            className={cn(
              MARKETING_HEADER_CHROME,
              "hidden font-label text-sm font-medium xl:inline",
              headerTone === "on-dark" ? "text-hero-foreground/85" : "text-on-surface-variant",
            )}
          >
            Account
          </span>
        </MarketingChromeIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(100vw-2rem,16rem)] p-0">
        <div className="border-b border-nav-border px-3 py-2.5 dark:border-border-hairline">
          <p className="font-body text-sm font-medium text-brand-900 dark:text-on-surface">
            Your account
          </p>
          <p className="mt-1 font-body text-xs leading-relaxed text-brand-400 dark:text-on-surface-variant">
            Sign in to save works, follow artists, and manage enquiries.
          </p>
        </div>
        <div className="flex flex-col gap-1 px-2 py-2">
          <DropdownMenuItem asChild className={menuItemClass(headerTone)}>
            {loginLink({
              href: loginHref,
              className: "w-full",
              children: loginLabel,
            })}
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
            {registerLink({
              href: registerHref,
              className: cn(
                "inline-flex min-h-11 w-full items-center justify-center rounded bg-cta-bg px-3 py-2 text-center font-label text-xs font-semibold text-cta-on transition-opacity hover:opacity-95",
                FOCUS_RING,
              ),
              children: registerLabel,
            })}
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type MarketingAuthenticatedAccountMenuProps = {
  displayName: string;
  email: string;
  accountHref: string;
  logoutHref: string;
  navItems: MarketingAccountNavItem[];
  productLinks?: Array<{ id: string; href: string; label: string; current?: boolean }>;
  headerTone: MarketingHeaderTone;
  onNavigate?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function MarketingAuthenticatedAccountMenu({
  displayName,
  email,
  accountHref,
  logoutHref,
  navItems,
  productLinks = [],
  headerTone,
  onNavigate,
  open,
  onOpenChange,
}: MarketingAuthenticatedAccountMenuProps) {
  const otherProducts = productLinks.filter((link) => !link.current);
  const initials = accountInitials(displayName, email);
  const signOutFormRef = useRef<HTMLFormElement>(null);
  const menuProps =
    open !== undefined && onOpenChange
      ? { open, onOpenChange }
      : { ...(onOpenChange ? { onOpenChange } : {}) };

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
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-label text-xs font-medium",
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
                "hidden min-w-0 truncate font-label text-sm font-medium leading-tight sm:inline",
                headerTone === "on-dark"
                  ? "text-hero-foreground"
                  : "text-brand-900 dark:text-on-surface",
              )}
            >
              {accountTriggerName(displayName, email)}
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
                <DropdownMenuLabel className="px-3 py-1.5 font-label text-xs font-medium text-brand-400 dark:text-on-surface-variant">
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
            {navItems.map((item) => (
              <DropdownMenuItem key={item.href} asChild className={menuItemClass(headerTone)}>
                {item.external ? (
                  <a
                    href={item.href}
                    rel="noopener noreferrer"
                    {...(onNavigate ? { onClick: onNavigate } : {})}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link href={item.href} {...(onNavigate ? { onClick: onNavigate } : {})}>
                    {item.label}
                  </Link>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem asChild className={menuItemClass(headerTone)}>
              <Link href={accountHref} {...(onNavigate ? { onClick: onNavigate } : {})}>
                Account overview
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
