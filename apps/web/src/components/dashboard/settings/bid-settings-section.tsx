import type { BidSettingsSection as SectionId } from "@/lib/navigation/settings-links";
import { Notice } from "@auction/ui/lax";
import type { ReactNode } from "react";

type BidSettingsSectionProps = {
  id: SectionId;
  title: string;
  /** One or two sentences on what the section changes. */
  description: string;
  children: ReactNode;
};

/**
 * One section of Bid settings: its name and a sentence in a 256px column on the left, the
 * settings on the right, stacked on phones. Sections follow each other divided by a hairline, and
 * each is an anchor so a link (or an email) opens the page at it.
 */
export function BidSettingsSection({ id, title, description, children }: BidSettingsSectionProps) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="grid scroll-mt-24 gap-4 border-t border-lax-line py-6 md:grid-cols-[256px_minmax(0,1fr)] md:gap-10 md:py-8"
    >
      <div>
        <h2 id={headingId} className="font-headline text-lax-18 font-semibold text-lax-fg">
          {title}
        </h2>
        <p className="mt-2 text-lax-14 text-lax-muted">{description}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </section>
  );
}

/** A section whose settings could not be read: said calmly; the rest of the page still works. */
export function BidSettingsSectionError({ what }: { what: string }) {
  return (
    <Notice tone="danger" alert title={`We couldn't load your ${what}.`}>
      Your saved choices haven&apos;t changed, and the rest of this page works. Reload to try again.
    </Notice>
  );
}
