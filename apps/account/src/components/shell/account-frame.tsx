import type { SupportLinksVm } from "@/server/domain/account-links";
import type { AccountNavItemVm, ProductBarItemVm } from "@/server/domain/account-nav.vm";
import { LaxLockup } from "@auction/marketing-ui";
import { Button } from "@auction/ui/components/button";
import type { ReactNode } from "react";
import { AccountAvatarMenu } from "./account-avatar-menu.client";
import { AccountMenuSheet } from "./account-menu-sheet.client";
import { AccountNav } from "./account-nav.client";
import { AccountThemeToggle } from "./account-theme-toggle.client";
import type { AccountViewer } from "./account-viewer";
import { ProductBar } from "./product-bar";

/** Content column next to the menu. Pages that hold tables ask for the wide one. */
const COLUMN_WIDTH = { narrow: "max-w-3xl", wide: "max-w-5xl" } as const;

const GUTTER = "px-4 sm:px-6 lg:px-10";
const CONTAINER = `mx-auto w-full max-w-[1440px] ${GUTTER}`;

export type AccountFrameProps = {
  /** The signed-in person; null on pages a signed-out visitor can reach. */
  viewer: AccountViewer | null;
  nav: AccountNavItemVm[];
  products: ProductBarItemVm[];
  support: SupportLinksVm | null;
  width?: keyof typeof COLUMN_WIDTH;
  children: ReactNode;
};

/**
 * The shell every page after sign-in wears, in the pattern of the other LAX products: the product
 * bar, a compact lockup, a theme toggle and the avatar menu across the top, and the menu down the
 * left on desktop (a sheet opened from the header on a phone).
 */
export function AccountFrame({
  viewer,
  nav,
  products,
  support,
  width = "narrow",
  children,
}: AccountFrameProps) {
  const showMenu = viewer !== null && nav.length > 0;
  return (
    <div className="flex min-h-screen flex-col bg-page-bg">
      <header className="border-b border-border-hairline bg-surface">
        <div className={`${CONTAINER} flex flex-col`}>
          <ProductBar items={products} className="hidden pt-3 pb-1 lg:flex" />
          <div className="flex h-16 items-center gap-4 lg:h-[72px]">
            <a href="/" className="flex min-h-11 shrink-0 items-center rounded-sm">
              <LaxLockup kind="account" className="block h-8 w-auto sm:h-10" />
            </a>
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <AccountThemeToggle />
              {viewer ? (
                <>
                  <AccountAvatarMenu viewer={viewer} />
                  {showMenu ? (
                    <AccountMenuSheet viewer={viewer} items={nav} products={products} />
                  ) : null}
                </>
              ) : (
                <Button asChild variant="cta" size="sm" className="min-h-11">
                  <a href="/api/auth/login?returnTo=/account">Sign in</a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>
      <div className={`${CONTAINER} flex flex-1 gap-10 lg:gap-14`}>
        {showMenu ? (
          <aside className="hidden w-60 shrink-0 py-8 lg:block">
            <AccountNav items={nav} className="sticky top-8" />
          </aside>
        ) : null}
        <main
          id="main"
          className={`flex w-full min-w-0 flex-1 flex-col gap-8 py-8 sm:py-10 ${
            showMenu ? COLUMN_WIDTH[width] : "mx-auto max-w-2xl"
          }`}
        >
          {children}
        </main>
      </div>
      <AccountFooter support={support} />
    </div>
  );
}

/** Privacy and help only: Bid publishes the policies that cover the LAX account. */
export function AccountFooter({
  support,
  bare = false,
}: {
  support: SupportLinksVm | null;
  /** Skip the page container, for a footer that sits inside a panel with its own padding. */
  bare?: boolean;
}) {
  return (
    <footer
      className={`${bare ? "" : CONTAINER} flex flex-wrap items-center gap-x-6 gap-y-2 pt-4 pb-8 text-xs text-on-surface-variant`}
    >
      <span>© LAX</span>
      {support ? (
        <nav aria-label="Legal and help" className="flex flex-wrap gap-x-6 gap-y-2">
          <a
            href={support.privacyPolicy}
            className="underline underline-offset-4 hover:text-on-surface"
          >
            Privacy
          </a>
          <a
            href={support.helpCentre}
            className="underline underline-offset-4 hover:text-on-surface"
          >
            Help
          </a>
        </nav>
      ) : null}
    </footer>
  );
}
