import { MaterialIcon } from "@/components/ui/material-icon";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="w-full bg-inverse-surface text-inverse-on-surface">
      <div className="mx-auto grid max-w-[1920px] grid-cols-1 gap-16 px-6 py-24 md:grid-cols-12 md:px-20">
        <div className="md:col-span-5">
          <div className="mb-8 font-headline text-2xl italic text-inverse-on-surface">
            The Digital Curator
          </div>
          <p className="max-w-md text-xs uppercase leading-relaxed tracking-[0.2em] text-inverse-on-surface/70">
            A global destination for the curation of world-class fine art and timeless digital
            collectibles for the modern connoisseur.
          </p>
          <div className="mt-12 flex gap-4">
            <a
              href="https://example.com"
              className="rounded-md p-2 text-inverse-on-surface/60 transition-colors hover:text-inverse-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-fixed"
              aria-label="Website"
            >
              <MaterialIcon name="public" />
            </a>
            <a
              href="mailto:concierge@example.com"
              className="rounded-md p-2 text-inverse-on-surface/60 transition-colors hover:text-inverse-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-fixed"
              aria-label="Email concierge"
            >
              <MaterialIcon name="mail" />
            </a>
          </div>
        </div>
        <div className="md:col-span-7 grid grid-cols-2 gap-12 lg:grid-cols-3">
          <div>
            <h5 className="mb-8 font-label text-xs font-bold uppercase tracking-[0.3em] text-inverse-on-surface">
              Galleries
            </h5>
            <ul className="space-y-4">
              <li>
                <Link
                  href="/"
                  className="font-label text-xs uppercase tracking-[0.2em] text-inverse-on-surface/70 transition-colors hover:text-primary-fixed"
                >
                  Live Auctions
                </Link>
              </li>
              <li>
                <Link
                  href="/#archive"
                  className="font-label text-xs uppercase tracking-[0.2em] text-inverse-on-surface/70 transition-colors hover:text-primary-fixed"
                >
                  Past Archives
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h5 className="mb-8 font-label text-xs font-bold uppercase tracking-[0.3em] text-inverse-on-surface">
              Concierge
            </h5>
            <ul className="space-y-4 font-label text-xs uppercase tracking-[0.2em] text-inverse-on-surface/70">
              <li>
                <Link href="/terms" className="transition-colors hover:text-primary-fixed">
                  Bidding Terms
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="transition-colors hover:text-primary-fixed">
                  Global Shipping
                </Link>
              </li>
              <li>
                <Link href="/about" className="transition-colors hover:text-primary-fixed">
                  About
                </Link>
              </li>
              <li>
                <a
                  href="mailto:concierge@example.com"
                  className="transition-colors hover:text-primary-fixed"
                >
                  Contact Us
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1920px] flex-col items-center justify-between border-t border-white/5 px-6 py-10 md:flex-row md:px-20">
        <p className="mb-4 font-label text-xs uppercase tracking-[0.4em] text-secondary md:mb-0">
          © {new Date().getFullYear()} The Digital Curator Gallery. Fine Art Excellence.
        </p>
        <div className="flex gap-8">
          <Link
            href="/privacy"
            className="text-xs uppercase tracking-[0.3em] text-inverse-on-surface/60 transition-colors hover:text-inverse-on-surface"
          >
            Privacy
          </Link>
          <Link
            href="/legal"
            className="text-xs uppercase tracking-[0.3em] text-inverse-on-surface/60 transition-colors hover:text-inverse-on-surface"
          >
            Legal
          </Link>
          <Link
            href="/contact"
            className="text-xs uppercase tracking-[0.3em] text-inverse-on-surface/60 transition-colors hover:text-inverse-on-surface"
          >
            Contact
          </Link>
        </div>
      </div>
    </footer>
  );
}
