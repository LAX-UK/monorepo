"use client";

import { ShopAccountStatus } from "@/components/header/shop-account-status";
import { ShopAuthLink } from "@/components/shop-auth-link";
import { isShopAuthHref } from "@/lib/is-shop-auth-href";
import { shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { FOCUS_RING } from "@auction/branding";
import type { AccountChromeState, LaxProductLinkVm } from "@auction/lax-ecosystem";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type MouseEvent, useEffect, useRef, useState } from "react";

const ORDERS_HREF = "/account/orders";

type ShopMobileAuthSectionProps = {
  account: AccountChromeState;
  productLinks?: LaxProductLinkVm[];
  onNavigate?: () => void;
};

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
      if (!isShopAuthHref(href)) {
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

function MobileGuestAuthSection({
  registerHref,
  loginHref,
  onNavigate,
}: {
  registerHref: string;
  loginHref: string;
  onNavigate?: () => void;
}) {
  const { pending, handleClick } = useGuestAuthPending(onNavigate);

  return (
    <div className="flex w-full flex-col items-center gap-3" aria-busy={pending !== null}>
      <Button variant="cta" size="lg" className="w-full" asChild>
        <ShopAuthLink
          href={registerHref}
          className={cn("w-full justify-center", pending && "pointer-events-none opacity-60")}
          aria-disabled={pending !== null}
          onClick={handleClick("register", registerHref)}
        >
          {pending === "register" ? "Opening…" : "Create account"}
        </ShopAuthLink>
      </Button>
      <ShopAuthLink
        href={loginHref}
        className={cn(
          "inline-flex min-h-11 w-full items-center justify-center rounded-sm py-2 font-label text-sm font-medium uppercase tracking-wide text-brand-900 underline-offset-4 transition-colors hover:text-brand-800 hover:underline dark:text-on-surface dark:hover:text-on-surface-variant",
          pending && "pointer-events-none opacity-60",
          FOCUS_RING,
        )}
        aria-disabled={pending !== null}
        onClick={handleClick("login", loginHref)}
      >
        {pending === "login" ? "Signing in…" : "Sign in"}
      </ShopAuthLink>
    </div>
  );
}

function MobileAuthenticatedAuthSection({
  displayName,
  email,
  accountHref,
  logoutHref,
  productLinks,
  onNavigate,
}: {
  displayName: string;
  email: string;
  accountHref: string;
  logoutHref: string;
  productLinks: LaxProductLinkVm[];
  onNavigate?: () => void;
}) {
  const signOutFormRef = useRef<HTMLFormElement>(null);
  const otherProducts = productLinks.filter((link) => !link.current);

  const linkClass = cn(
    "block min-h-11 rounded-sm py-2 font-label text-sm font-medium uppercase tracking-wide",
    "text-brand-900 transition-colors hover:text-brand-800 dark:text-on-surface",
    FOCUS_RING,
  );

  return (
    <>
      <form ref={signOutFormRef} action={logoutHref} method="post" hidden />
      <p className="font-label text-xs font-semibold uppercase tracking-wide text-brand-400 dark:text-on-surface-variant">
        Account
      </p>
      <div className="rounded-md border border-nav-border bg-page-bg px-3 py-2 dark:border-border-hairline dark:bg-surface-container-low">
        <p className="font-body text-sm font-medium text-brand-900 dark:text-on-surface">
          {displayName.trim() || "Signed in"}
        </p>
        {email ? (
          <p className="mt-0.5 truncate font-body text-xs text-brand-400 dark:text-on-surface-variant">
            {email}
          </p>
        ) : null}
      </div>
      <ul className="flex flex-col gap-0.5">
        {otherProducts.map((item) => (
          <li key={item.id}>
            <a
              href={item.href}
              className={linkClass}
              rel="noopener noreferrer"
              {...(onNavigate ? { onClick: onNavigate } : {})}
            >
              {item.label}
            </a>
          </li>
        ))}
        <li>
          <Link
            href={accountHref}
            className={linkClass}
            {...(onNavigate ? { onClick: onNavigate } : {})}
          >
            My account
          </Link>
        </li>
        <li>
          <Link
            href={ORDERS_HREF}
            className={linkClass}
            {...(onNavigate ? { onClick: onNavigate } : {})}
          >
            Orders
          </Link>
        </li>
      </ul>
      <button
        type="button"
        className={cn(
          "block w-full rounded-md border border-nav-border py-3 text-center font-label text-sm font-medium uppercase tracking-wide text-brand-900 transition-colors hover:bg-page-bg disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-hairline dark:text-on-surface dark:hover:bg-surface-container-low",
          FOCUS_RING,
        )}
        onClick={() => {
          onNavigate?.();
          signOutFormRef.current?.requestSubmit();
        }}
      >
        Sign out
      </button>
    </>
  );
}

/** Mobile drawer footer auth — inline actions like Bid, no nested account dropdown. */
export function ShopMobileAuthSection({
  account,
  productLinks = [],
  onNavigate,
}: ShopMobileAuthSectionProps) {
  const pathname = usePathname();

  return (
    <div className="shop-header__mobile-account flex w-full flex-col gap-3 border-t border-nav-border pt-4">
      {account.kind === "guest" ? (
        <MobileGuestAuthSection
          registerHref={account.registerHref}
          loginHref={shopStorefrontLoginHref(pathname || "/")}
          {...(onNavigate ? { onNavigate } : {})}
        />
      ) : null}
      {account.kind === "authenticated" ? (
        <MobileAuthenticatedAuthSection
          displayName={account.displayName}
          email={account.email}
          accountHref={account.accountHref}
          logoutHref={account.logoutHref}
          productLinks={productLinks}
          {...(onNavigate ? { onNavigate } : {})}
        />
      ) : null}
      {account.kind === "disabled" ? (
        <ShopAccountStatus
          kind="disabled"
          detailMessage={account.message}
          {...(account.accountHref ? { accountHref: account.accountHref } : {})}
          {...(onNavigate ? { onNavigate } : {})}
        />
      ) : null}
      {account.kind === "unavailable" ? (
        <ShopAccountStatus kind="unavailable" detailMessage={account.message} />
      ) : null}
    </div>
  );
}
