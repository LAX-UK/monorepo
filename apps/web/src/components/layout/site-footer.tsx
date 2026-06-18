import { FooterColumn } from "@/components/layout/footer-column";
import {
  auctionsLinks,
  companyLinks,
  legalLinks,
  serviceLinks,
} from "@/components/layout/footer-link-groups";
import { FooterSocials } from "@/components/layout/footer-socials";
import { LaxLogo } from "@/components/layout/lax-logo";
import { CookiePreferencesLink } from "@/components/marketing/consent/cookie-preferences-link";
import { FOOTER_NAV_LABEL_CLASSES } from "@/components/marketing/nav-label";
import { siteCopyrightLine } from "@/lib/brand";
import { FOCUS_RING, MARKETING_PAGE_GUTTER_X } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

type SiteFooterProps = {
  /** Tagline rendered next to the wordmark. Defaults to the brand strapline. */
  tagline?: ReactNode;
  /** Cities/regions strapline appended to the bottom row. */
  regionsLine?: ReactNode;
};

export function SiteFooter({
  tagline = "Fine art auctions since 2018.",
  regionsLine = "London",
}: SiteFooterProps = {}) {
  const linkClass = cn(
    "rounded-sm font-footer-links text-base font-medium leading-6 text-on-surface/90 transition-colors hover:text-link",
    FOCUS_RING,
  );
  const headingClass = FOOTER_NAV_LABEL_CLASSES;

  return (
    <footer className="w-full bg-footer-bg">
      <div
        className={cn(
          "mx-auto flex max-w-[var(--container-max,1440px)] flex-col gap-12 py-12",
          MARKETING_PAGE_GUTTER_X,
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-8">
          <LaxLogo variant="footer" />
          {tagline ? (
            <p className="font-headline text-lg font-light italic text-on-surface-variant">
              {tagline}
            </p>
          ) : null}
        </div>
        <div className="h-px w-full max-w-[var(--container-inner,1376px)] bg-divider" aria-hidden />
        <div className="grid max-w-[var(--container-inner,1376px)] grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(20rem,1.35fr)]">
          <FooterColumn
            title="Auctions"
            links={auctionsLinks}
            linkClassName={linkClass}
            headingClassName={headingClass}
          />
          <FooterColumn
            title="Company"
            links={companyLinks}
            linkClassName={linkClass}
            headingClassName={headingClass}
          />
          <div className="flex flex-col gap-4">
            <FooterColumn
              title="Legal"
              links={legalLinks}
              linkClassName={linkClass}
              headingClassName={headingClass}
            />
            <CookiePreferencesLink className={linkClass} />
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            <FooterColumn
              title="Our Services"
              links={serviceLinks}
              linkClassName={linkClass}
              headingClassName={headingClass}
            />
            <FooterSocials />
          </div>
        </div>
        <div className="flex max-w-[var(--container-inner,1376px)] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <LaxLogo variant="header" className="opacity-90" />
          <div className="flex flex-col gap-1 sm:items-end">
            <p className="font-label text-sm font-medium leading-5 text-on-surface-variant">
              {siteCopyrightLine()}
            </p>
            {regionsLine ? (
              <p className="font-label text-xs uppercase tracking-[0.18em] text-on-surface-variant/80">
                {regionsLine}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
