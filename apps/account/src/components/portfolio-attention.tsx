import type { AttentionRowVm } from "@/server/domain/portfolio-attention.vm";
import { MarketingViewAllChevron } from "@auction/marketing-ui";
import { InsetGroup } from "@auction/ui/components/inset-group";
import { ListRow } from "@auction/ui/components/list-row";

/** Whole-row links to the next step for each work that needs one. Hidden when nothing does. */
export function PortfolioAttention({ rows }: { rows: AttentionRowVm[] }) {
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="portfolio-attention-heading" className="flex flex-col gap-3">
      <h2 id="portfolio-attention-heading" className="font-headline text-lg font-semibold">
        Needs your attention
      </h2>
      <InsetGroup>
        {rows.map((row) => (
          <ListRow
            key={row.key}
            title={row.text}
            subtitle={row.external ? `Opens ${row.productLabel}` : "View details"}
            href={row.href}
            trailing={<MarketingViewAllChevron className="text-on-surface-variant" />}
          />
        ))}
      </InsetGroup>
    </section>
  );
}
