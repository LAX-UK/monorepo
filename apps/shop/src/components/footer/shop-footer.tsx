import { ShopLaxLogo } from "@/components/layout/shop-lax-logo";
import { buildShopPolicyLinks, shopFooterCopyright } from "@/content/footer-nav.config";
import type { ShopFooterAccountState } from "@/lib/shop-footer-account-state";
import { FOCUS_RING, MARKETING_PAGE_GUTTER_X } from "@auction/branding";
import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { MarketingFooterSocials } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

type ShopFooterProps = {
  crossProductLinks?: LaxProductLinkVm[];
  accountState?: ShopFooterAccountState;
};

export function ShopFooter({
  crossProductLinks = [],
  accountState = { kind: "guest" },
}: ShopFooterProps) {
  const bidLink = crossProductLinks.find((link) => link.id === "bid");
  const policyLinks = bidLink ? buildShopPolicyLinks(bidLink.href) : [];
  const linkClass = cn(
    "rounded-sm font-footer-links text-base font-medium leading-6 text-on-surface/90 transition-colors hover:text-link",
    FOCUS_RING,
  );
  const headingClass =
    "font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant";

  return (
    <footer
      className="w-full bg-[var(--color-footer-bg,#ededef)]"
      aria-labelledby="shop-footer-heading"
    >
      <h2 id="shop-footer-heading" className="sr-only">
        Site footer
      </h2>
      <div
        className={cn(
          "mx-auto flex max-w-[var(--container-max,90rem)] flex-col gap-12 py-12",
          MARKETING_PAGE_GUTTER_X,
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-8">
          <Link href="/" className={cn("inline-flex", FOCUS_RING)} aria-label="LAX Shop home">
            <ShopLaxLogo variant="footer" className="shop-footer__logo" />
          </Link>
          <p className="font-headline text-lg font-light italic text-on-surface-variant">
            Collect contemporary art editions from London Art Exchange.
          </p>
        </div>
        <div
          className="h-px w-full max-w-[var(--container-inner,86rem)] bg-border-hairline"
          aria-hidden
        />
        <div className="grid max-w-[var(--container-inner,86rem)] grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4">
          {crossProductLinks.length > 0 ? (
            <nav aria-labelledby="footer-lax-products">
              <h3 id="footer-lax-products" className={headingClass}>
                LAX products
              </h3>
              <ul className="mt-4 flex flex-col gap-3">
                {crossProductLinks.map((link) => (
                  <li key={link.id}>
                    <a href={link.href} className={linkClass} rel="noopener noreferrer">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          {policyLinks.length > 0 ? (
            <nav aria-labelledby="footer-policies">
              <h3 id="footer-policies" className={headingClass}>
                Policies
              </h3>
              <ul className="mt-4 flex flex-col gap-3">
                {policyLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className={linkClass}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <nav aria-labelledby="footer-shop">
            <h3 id="footer-shop" className={headingClass}>
              Shop
            </h3>
            <ul className="mt-4 flex flex-col gap-3">
              <li>
                <Link href="/artworks" className={linkClass}>
                  Artworks
                </Link>
              </li>
              <li>
                <Link href="/artists" className={linkClass}>
                  Artists
                </Link>
              </li>
              <li>
                <Link href="/categories" className={linkClass}>
                  Categories
                </Link>
              </li>
              {accountState.kind === "guest" ? (
                <li>
                  <Link href="/register" className={linkClass}>
                    Join us
                  </Link>
                </li>
              ) : accountState.kind === "authenticated" ? (
                <li>
                  <Link href="/account" className={linkClass}>
                    Your account
                  </Link>
                </li>
              ) : accountState.kind === "disabled" ? (
                <li>
                  <Link href={accountState.accountHref} className={linkClass}>
                    Account status
                  </Link>
                </li>
              ) : (
                <li>
                  <span className="font-footer-links text-base text-on-surface-variant">
                    Sign-in status unavailable
                  </span>
                </li>
              )}
            </ul>
          </nav>
          <div className="flex flex-col gap-4">
            <h3 className={headingClass}>Connect</h3>
            <MarketingFooterSocials className="mt-1" />
          </div>
        </div>
        <div
          className="h-px w-full max-w-[var(--container-inner,86rem)] bg-border-hairline"
          aria-hidden
        />
        <p className="font-supporting text-sm text-on-surface-variant">{shopFooterCopyright}</p>
      </div>
    </footer>
  );
}
