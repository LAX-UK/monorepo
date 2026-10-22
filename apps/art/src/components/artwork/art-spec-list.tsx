import type { ArtworkSpecRow } from "@/lib/artwork/artwork-detail.vm";
import { MarketingSpecList } from "@auction/marketing-ui";

/** Spec rows as a `MarketingSpecList`; multi-line values (cm, then inches) stack. */
export function ArtSpecList({ rows }: { rows: readonly ArtworkSpecRow[] }) {
  return (
    <MarketingSpecList
      items={rows.map((row) => ({
        label: row.label,
        value: row.lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        )),
      }))}
    />
  );
}
