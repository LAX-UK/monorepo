import { SITE_NAME } from "@/lib/brand";
import type { TocNavItem } from "@auction/ui";
import { TocNav } from "@auction/ui";
import type { ReactNode } from "react";

type Props = {
  title: string;
  kicker?: string;
  /** Optional table of contents (anchor ids must exist in `children`) */
  toc?: readonly TocNavItem[];
  /** ISO date string or display text */
  lastUpdated?: string;
  embedded?: boolean;
  children: ReactNode;
};

export function LegalPage({
  title,
  kicker = SITE_NAME,
  toc,
  lastUpdated,
  embedded,
  children,
}: Props) {
  const content = (
    <>
      <p className="mb-3 font-label text-xs font-bold uppercase tracking-[0.3em] text-primary">
        {kicker}
      </p>
      <h1 className="mb-6 font-headline text-4xl tracking-tight text-on-surface md:text-5xl">
        {title}
      </h1>
      {lastUpdated ? (
        <p className="mb-8 font-footer-links text-xs text-on-surface-variant">
          Last updated: {lastUpdated}
        </p>
      ) : null}
      {toc && toc.length > 0 ? (
        <div className="mb-10 lg:float-right lg:mb-4 lg:ml-8 lg:w-56 lg:pl-2">
          <TocNav items={toc} sticky={false} />
        </div>
      ) : null}
      <div className="clear-both space-y-6 font-body text-sm leading-relaxed text-on-surface-variant md:text-base">
        {children}
      </div>
    </>
  );

  if (embedded) {
    return <section className="legal-print max-w-3xl px-6 py-12 md:px-16">{content}</section>;
  }

  return (
    <main
      id="main-content"
      className="legal-print mx-auto max-w-3xl px-6 pb-24 pt-[var(--section-pt)] md:px-10 lg:pt-32"
    >
      {content}
    </main>
  );
}
