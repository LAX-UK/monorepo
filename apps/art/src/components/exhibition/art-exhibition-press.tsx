import { ArtEditorialLink } from "@/components/editorial/art-editorial-link";
import type { ExhibitionPressVm } from "@/lib/editorial/exhibition-page.vm";
import { MarketingEditorialListRow } from "@auction/marketing-ui";

/** Press stories as arrowed list rows (Figma Press, `743:20964`, mobile `606:10398`). */
export function ArtExhibitionPress({ items }: { items: readonly ExhibitionPressVm[] }) {
  return (
    <ul
      className="m-0 flex max-w-4xl list-none flex-col border-t border-outline-variant p-0"
      aria-label="Press"
    >
      {items.map((item) => (
        <li key={item.key}>
          <MarketingEditorialListRow
            title={item.title}
            meta={item.dateLabel}
            href={item.href}
            linkAs={ArtEditorialLink}
          />
        </li>
      ))}
    </ul>
  );
}
