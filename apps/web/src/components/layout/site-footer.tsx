import { FooterColumn } from "@/components/layout/footer-column";
import { FooterSocials } from "@/components/layout/footer-socials";
import { LaxLogo } from "@/components/layout/lax-logo";
import { siteCopyrightLine } from "@/lib/brand";

const aboutLinks = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms" },
  { href: "/sitemap.xml", label: "Sitemap" },
];

const serviceLinks = [
  { href: "/dashboard/submissions/new", label: "Sell to Us" },
  { href: "/contact", label: "Client services" },
  { href: "/archive", label: "Past auctions" },
];

const policyLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/legal", label: "Legal" },
  { href: "/terms", label: "Terms of use" },
  { href: "/shipping", label: "Shipping" },
];

export function SiteFooter() {
  const linkClass =
    "font-footer-links text-base font-medium leading-6 text-brand-800 transition-colors hover:text-brand-900";
  const headingClass =
    "font-label text-base font-bold uppercase leading-6 tracking-normal text-brand-800";

  return (
    <footer className="w-full bg-footer-bg">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-12 px-10 py-12 md:px-20 md:py-12">
        <div className="flex flex-wrap items-center gap-8">
          <LaxLogo variant="footer" />
        </div>
        <div className="h-px w-full max-w-[1280px] bg-divider" aria-hidden />
        <div className="grid max-w-[1280px] grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-4">
          <FooterColumn
            title="About us"
            links={aboutLinks}
            linkClassName={linkClass}
            headingClassName={headingClass}
          />
          <FooterColumn
            title="Our Services"
            links={serviceLinks}
            linkClassName={linkClass}
            headingClassName={headingClass}
          />
          <FooterColumn
            title="Policies"
            links={policyLinks}
            linkClassName={linkClass}
            headingClassName={headingClass}
          />
          <div className="flex flex-col gap-6">
            <h2 className={headingClass}>Contact us</h2>
            <div className="flex flex-col gap-2">
              <p className={linkClass}>Join Us</p>
              <FooterSocials />
            </div>
          </div>
        </div>
        <div className="h-px w-full max-w-[1280px] bg-divider" aria-hidden />
        <div className="flex max-w-[1280px] flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <LaxLogo variant="header" className="opacity-90" />
          <p className="font-label text-sm font-medium leading-5 text-brand-500">
            {siteCopyrightLine()}
          </p>
        </div>
      </div>
    </footer>
  );
}
