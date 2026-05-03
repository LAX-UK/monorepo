import { FooterColumn } from "@/components/layout/footer-column";
import {
  auctionsLinks,
  companyLinks,
  legalLinks,
  serviceLinks,
} from "@/components/layout/footer-link-groups";
import { FooterSocials } from "@/components/layout/footer-socials";
import { LaxLogo } from "@/components/layout/lax-logo";
import { siteCopyrightLine } from "@/lib/brand";
import type { ReactNode } from "react";

type SiteFooterProps = {
  /** Tagline rendered next to the wordmark. Defaults to the brand strapline. */
  tagline?: ReactNode;
  /** Cities/regions strapline appended to the bottom row. */
  regionsLine?: ReactNode;
};

export function SiteFooter({
  tagline = "Fine art auctions since 2018.",
  regionsLine = "London \u00B7 New York \u00B7 Hong Kong",
}: SiteFooterProps = {}) {
  const linkClass =
    "font-footer-links text-base font-medium leading-6 text-on-surface/90 transition-colors hover:text-primary";
  const headingClass =
    "font-label text-base font-bold uppercase leading-6 tracking-normal text-on-surface";

  return (
    <footer className="w-full bg-footer-bg">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-12 px-10 py-12 md:px-20 md:py-12">
        <div className="flex flex-wrap items-center justify-between gap-8">
          <LaxLogo variant="footer" />
          {tagline ? (
            <p className="font-headline text-lg font-light italic text-on-surface-variant">
              {tagline}
            </p>
          ) : null}
        </div>
        <div className="h-px w-full max-w-[1280px] bg-divider" aria-hidden />
        <div className="grid max-w-[1280px] grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4">
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
          <FooterColumn
            title="Legal"
            links={legalLinks}
            linkClassName={linkClass}
            headingClassName={headingClass}
          />
          <div className="flex flex-col gap-6">
            <h2 className={headingClass}>Our Services</h2>
            <ul className="flex flex-col gap-4">
              {serviceLinks.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className={linkClass}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
            <FooterSocials />
            <a
              href="/register"
              className={`${linkClass} inline-flex min-h-11 items-center underline-offset-2 hover:underline`}
            >
              Join us
            </a>
          </div>
        </div>
        <div className="h-px w-full max-w-[1280px] bg-divider" aria-hidden />
        <div className="flex max-w-[1280px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
