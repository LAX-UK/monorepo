import { MarketingSectionHeader } from "@/components/marketing/marketing-section-header";
import { SITE_BUSINESS_ADDRESS_INLINE, SITE_NAME, SITE_PRESS_EMAIL } from "@/lib/brand";
import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { DisplayHeading } from "@auction/ui";
import Link from "next/link";

export function PressMediaKitBlock() {
  return (
    <section
      id="press-media-kit"
      aria-labelledby="press-media-kit-title"
      className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-7 dark:bg-surface-container-low/40"
    >
      <MarketingSectionHeader
        heading={
          <DisplayHeading
            as="h2"
            id="press-media-kit-title"
            size="section"
            className="font-semibold text-on-surface"
          >
            Media kit
          </DisplayHeading>
        }
        subtitle="Background and assets for journalists covering our auctions."
      />
      <p className="mt-4 max-w-2xl font-body text-sm leading-relaxed text-on-surface-variant">
        {SITE_NAME} is a London-based fine art auction platform specialising in curated sales across
        contemporary, modern, and decorative art. Since 2018 we have connected collectors, estates,
        and institutions through transparent online and saleroom auctions.
      </p>
      <p className="mt-3 max-w-2xl font-body text-sm text-on-surface-variant">
        Registered office: {SITE_BUSINESS_ADDRESS_INLINE}. Press enquiries:{" "}
        <a href={`mailto:${SITE_PRESS_EMAIL}`} className={MARKETING_PROSE_LINK}>
          {SITE_PRESS_EMAIL}
        </a>
        .
      </p>
      <div className="mt-6">
        <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Brand assets
        </p>
        <ul className="mt-3 flex flex-col gap-2 font-body text-sm">
          <li>
            <a href="/logo.svg" className={MARKETING_PROSE_LINK} download>
              Logo (SVG, dark)
            </a>
          </li>
          <li>
            <a href="/logo-light.svg" className={MARKETING_PROSE_LINK} download>
              Logo (SVG, light)
            </a>
          </li>
          <li>
            <a href="/logo-text.svg" className={MARKETING_PROSE_LINK} download>
              Logo with wordmark (SVG)
            </a>
          </li>
        </ul>
      </div>
      <div className="mt-6">
        <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Further reading
        </p>
        <ul className="mt-3 flex flex-col gap-2 font-body text-sm">
          <li>
            <Link href="/about" className={MARKETING_PROSE_LINK}>
              About {SITE_NAME}
            </Link>
          </li>
          <li>
            <Link href="/contact?intent=press" className={MARKETING_PROSE_LINK}>
              Press contact form
            </Link>
          </li>
          <li>
            <Link href="/press/feed.xml" className={MARKETING_PROSE_LINK}>
              RSS feed
            </Link>
          </li>
        </ul>
      </div>
      <p className="mt-6 max-w-2xl font-body text-xs leading-relaxed text-on-surface-variant">
        Editorial use of our name and logos is permitted when reporting on {SITE_NAME} or our sales.
        Please do not modify logos or imply endorsement. For high-resolution brand files or bespoke
        interview requests, email{" "}
        <a href={`mailto:${SITE_PRESS_EMAIL}`} className={MARKETING_PROSE_LINK}>
          {SITE_PRESS_EMAIL}
        </a>
        .
      </p>
    </section>
  );
}
