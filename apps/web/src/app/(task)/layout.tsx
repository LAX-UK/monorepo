import { LaxLogo } from "@/components/layout/lax-logo";
import { SITE_LOGO_TEXT_PATH } from "@/lib/brand";
import Link from "next/link";
import type { ReactNode } from "react";

/** Minimal chrome for focused tasks (auth, onboarding) — no marketing mega nav or footer. */
export default function TaskLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-[var(--z-site-chrome,50)] border-b border-border-hairline bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex min-h-[var(--tap-target-min,44px)] items-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <LaxLogo
              variant="header"
              imageSrc={SITE_LOGO_TEXT_PATH}
              imageWidth={430}
              imageHeight={202}
            />
          </Link>
          <Link
            href="/search"
            className="inline-flex min-h-[var(--tap-target-min,44px)] items-center font-label text-xs font-semibold uppercase tracking-wider text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Browse catalogue
          </Link>
        </div>
      </header>
      {children}
    </>
  );
}
