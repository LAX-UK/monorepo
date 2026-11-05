"use client";

import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import Link from "next/link";
import type { ReactNode } from "react";
import { accountTriggerName } from "./account-display-name.js";
import { cutAccountEntryName } from "./account-entry-name.js";
import { MARKETING_HEADER_CHROME, type MarketingHeaderTone } from "./header/header-chrome-tone.js";
import { MarketingChevronDownIcon, MarketingUserIcon } from "./marketing-icons.js";

export type MarketingAccountEntryViewer = {
  displayName: string;
  email: string;
  /** Optional avatar image; initials are drawn when absent. */
  avatarUrl?: string;
};

export type MarketingAccountEntryProps = {
  /** `null` when signed out. */
  viewer: MarketingAccountEntryViewer | null;
  signInHref: string;
  createAccountHref: string;
  /** Signed in: the product's own account menu rows (`DropdownMenuItem`s). */
  menuItems?: ReactNode;
  /** Signed out: the line above the buttons. */
  signedOutIntro?: string;
  signInLabel?: string;
  createAccountLabel?: string;
  /** Shows a dot on the entry while something needs the person. */
  attention?: boolean;
  headerTone?: MarketingHeaderTone;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

const DEFAULT_INTRO = "One LAX Account for lax.art, LAX Shop and LAX Bid";

function initialsOf(viewer: MarketingAccountEntryViewer): string {
  const source = viewer.displayName.trim() || viewer.email;
  const parts = source.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/** The person's avatar image, or their initials on a round chip. Decorative: the control names it. */
export function MarketingAvatar({
  viewer,
  className,
}: {
  viewer: MarketingAccountEntryViewer;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        className,
      )}
    >
      {viewer.avatarUrl ? (
        <img src={viewer.avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        initialsOf(viewer)
      )}
    </span>
  );
}

/**
 * The header's single account control. Signed out it is a person icon and "Account" that opens a
 * small menu (what the account is, Sign in, Create account). Signed in it is the avatar, the
 * first name (cut at 12 characters) and a chevron that opens the product's own account menu.
 */
export function MarketingAccountEntry({
  viewer,
  signInHref,
  createAccountHref,
  menuItems,
  signedOutIntro = DEFAULT_INTRO,
  signInLabel = "Sign in",
  createAccountLabel = "Create account",
  attention = false,
  headerTone = "on-light",
  open,
  onOpenChange,
  className,
}: MarketingAccountEntryProps) {
  const onDark = headerTone === "on-dark";
  const text = onDark ? "text-hero-foreground" : "text-on-surface";
  const menuProps =
    open !== undefined && onOpenChange
      ? { open, onOpenChange }
      : onOpenChange
        ? { onOpenChange }
        : {};
  const dot = attention ? (
    <span
      aria-hidden
      data-testid="account-entry-attention"
      className="absolute top-2 left-6 size-2 rounded-full bg-danger"
    />
  ) : null;

  const trigger = viewer ? (
    <button
      type="button"
      aria-label={`Account menu, ${viewer.displayName.trim() || viewer.email}`}
      className={cn(
        MARKETING_HEADER_CHROME,
        "relative inline-flex min-h-11 items-center gap-2 rounded-sm px-1 font-label text-sm font-medium",
        text,
        FOCUS_RING,
        className,
      )}
    >
      <MarketingAvatar
        viewer={viewer}
        className={cn(
          "size-8 text-xs",
          onDark ? "bg-hero-foreground/15" : "bg-surface-container-high",
        )}
      />
      <span data-testid="account-entry-name">
        {cutAccountEntryName(accountTriggerName(viewer.displayName, viewer.email))}
      </span>
      <MarketingChevronDownIcon className="size-4" />
      {dot}
    </button>
  ) : (
    <button
      type="button"
      aria-label="Account menu"
      className={cn(
        MARKETING_HEADER_CHROME,
        "relative inline-flex min-h-11 items-center gap-1.5 rounded-sm px-1 font-label text-sm font-medium",
        text,
        FOCUS_RING,
        className,
      )}
    >
      <MarketingUserIcon />
      <span>Account</span>
      {dot}
    </button>
  );

  return (
    <DropdownMenu {...menuProps}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(100vw-2rem,16rem)] p-0">
        {viewer ? (
          menuItems
        ) : (
          <div className="flex flex-col gap-3 p-3">
            <p className="m-0 font-body text-sm text-on-surface">{signedOutIntro}</p>
            <DropdownMenuItem asChild className="p-0 focus:bg-transparent">
              <Link
                href={signInHref}
                className={cn(
                  "inline-flex min-h-11 w-full items-center justify-center rounded bg-cta-bg px-3 py-2 font-label text-sm font-semibold text-cta-on hover:opacity-95",
                  FOCUS_RING,
                )}
              >
                {signInLabel}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="min-h-11 cursor-pointer justify-center">
              <Link href={createAccountHref} className="font-label text-sm font-medium">
                {createAccountLabel}
              </Link>
            </DropdownMenuItem>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
