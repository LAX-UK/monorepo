"use client";

import { ArtAuthLink } from "@/components/art-auth-link";
import { artSignInHref } from "@/lib/auth/art-reauth.vm";
import { isArtAuthHref } from "@/lib/is-art-auth-href";
import {
  artAccountDisplayName,
  artAccountInitials,
  buildArtMobileAccountLinks,
} from "@/lib/layout/art-account-nav.vm";
import { FOCUS_RING } from "@auction/branding";
import type { AccountChromeState } from "@auction/lax-ecosystem";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { type MouseEvent, useEffect, useState } from "react";

const DRAWER_LINK = cn(
  "flex min-h-11 items-center rounded-sm font-label text-sm font-medium uppercase tracking-wide text-on-surface underline-offset-4 transition-colors hover:text-on-surface-variant aria-[current=page]:underline motion-reduce:transition-none",
  FOCUS_RING,
);

const SECTION_LABEL =
  "font-label text-xs font-semibold uppercase tracking-wide text-on-surface-variant";

type GuestAuthAction = "register" | "login";

/** Full-page auth redirects take seconds; keep the drawer open and show progress instead. */
function useGuestAuthPending(onNavigate?: () => void) {
  const [pending, setPending] = useState<GuestAuthAction | null>(null);

  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(null);
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const handleClick =
    (action: GuestAuthAction, href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
      if (!isArtAuthHref(href)) {
        onNavigate?.();
        return;
      }
      if (pending) {
        event.preventDefault();
        return;
      }
      setPending(action);
    };

  return { pending, handleClick };
}

function GuestAuthSection({
  registerHref,
  loginHref,
  onNavigate,
}: {
  registerHref: string;
  loginHref: string;
  onNavigate?: () => void;
}) {
  const { pending, handleClick } = useGuestAuthPending(onNavigate);
  const busy = pending !== null;

  return (
    <div className="flex w-full flex-col gap-3" aria-busy={busy}>
      <p className={SECTION_LABEL}>Account</p>
      <p className="font-body text-sm leading-relaxed text-on-surface-variant">
        Sign in to save works, follow artists, and manage enquiries.
      </p>
      <Button variant="cta" size="lg" className="w-full" asChild>
        <ArtAuthLink
          href={registerHref}
          className={cn(
            "w-full justify-center font-label",
            FOCUS_RING,
            busy && "pointer-events-none opacity-60",
          )}
          aria-disabled={busy}
          onClick={handleClick("register", registerHref)}
        >
          {pending === "register" ? "Opening…" : "Create account"}
        </ArtAuthLink>
      </Button>
      <ArtAuthLink
        href={loginHref}
        className={cn(DRAWER_LINK, "justify-center", busy && "pointer-events-none opacity-60")}
        aria-disabled={busy}
        onClick={handleClick("login", loginHref)}
      >
        {pending === "login" ? "Signing in…" : "Sign in"}
      </ArtAuthLink>
    </div>
  );
}

function AuthenticatedAuthSection({
  displayName,
  email,
  accountHref,
  logoutHref,
  pathname,
  onNavigate,
}: {
  displayName: string;
  email: string;
  accountHref: string;
  logoutHref: string;
  pathname: string;
  onNavigate?: () => void;
}) {
  const links = buildArtMobileAccountLinks(accountHref, pathname);

  return (
    <div className="flex w-full flex-col gap-3">
      <p className={SECTION_LABEL}>Account</p>
      <div className="flex items-center gap-3 rounded-md border border-nav-border bg-page-bg px-3 py-2">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high font-label text-xs font-semibold uppercase text-on-surface"
          aria-hidden
        >
          {artAccountInitials(displayName, email)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-body text-sm font-medium text-on-surface">
            {artAccountDisplayName(displayName)}
          </p>
          {email ? (
            <p className="truncate font-body text-xs text-on-surface-variant">{email}</p>
          ) : null}
        </div>
      </div>
      <nav aria-label="Your account">
        <ul className="flex flex-col">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={link.current ? "page" : undefined}
                className={DRAWER_LINK}
                {...(onNavigate ? { onClick: onNavigate } : {})}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <form action={logoutHref} method="post">
        <Button type="submit" variant="secondaryOutline" className={cn("w-full", FOCUS_RING)}>
          Sign out
        </Button>
      </form>
    </div>
  );
}

type ArtMobileAuthSectionProps = {
  account: AccountChromeState;
  pathname: string;
  onNavigate?: () => void;
};

/** Drawer footer auth: inline actions instead of a nested account dropdown. */
export function ArtMobileAuthSection({ account, pathname, onNavigate }: ArtMobileAuthSectionProps) {
  const navigateProps = onNavigate ? { onNavigate } : {};

  return (
    <div className="flex w-full flex-col gap-3 border-t border-nav-border pt-4">
      {account.kind === "guest" ? (
        <GuestAuthSection
          registerHref={account.registerHref}
          loginHref={artSignInHref(pathname)}
          {...navigateProps}
        />
      ) : null}
      {account.kind === "authenticated" ? (
        <AuthenticatedAuthSection
          displayName={account.displayName}
          email={account.email}
          accountHref={account.accountHref}
          logoutHref={account.logoutHref}
          pathname={pathname}
          {...navigateProps}
        />
      ) : null}
      {account.kind === "disabled" ? (
        <>
          <p className={SECTION_LABEL}>Account</p>
          <p className="font-body text-sm text-on-surface">{account.message}</p>
          <Link
            href={account.accountHref ?? "/account/disabled"}
            className={DRAWER_LINK}
            {...(onNavigate ? { onClick: onNavigate } : {})}
          >
            Account status
          </Link>
        </>
      ) : null}
      {account.kind === "unavailable" ? (
        <>
          <p className={SECTION_LABEL}>Account</p>
          <p className="font-body text-sm text-on-surface-variant">{account.message}</p>
        </>
      ) : null}
    </div>
  );
}
