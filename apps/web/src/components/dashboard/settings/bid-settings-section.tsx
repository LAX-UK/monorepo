import type { BidSettingsSection as SectionId } from "@/lib/navigation/settings-links";
import type { ReactNode } from "react";

type BidSettingsSectionProps = {
  id: SectionId;
  title: string;
  /** One or two sentences on what the section changes. */
  description: string;
  children: ReactNode;
};

/**
 * One section of Bid settings: its name and a sentence on the left, the settings on the right,
 * stacked on phones. Sections follow each other in one calm column, divided by a hairline, and
 * each is an anchor so links can open the page at it.
 */
export function BidSettingsSection({ id, title, description, children }: BidSettingsSectionProps) {
  const headingId = `${id}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="grid scroll-mt-[calc(var(--header-height)+4rem)] gap-5 border-t border-outline-variant/60 py-8 first:border-t-0 first:pt-0 md:grid-cols-[17rem_minmax(0,1fr)] md:gap-10"
    >
      <div>
        <h2 id={headingId} className="font-headline text-lg font-semibold text-on-surface">
          {title}
        </h2>
        <p className="mt-1.5 max-w-[34ch] font-body text-sm text-on-surface-variant">
          {description}
        </p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
