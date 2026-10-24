import type { AttentionRowVm } from "@/server/domain/portfolio-attention.vm";
import { AccountSection, ListCard, ListCardRow } from "./account-ui";

/** Whole-row links to the next step for each work that needs one. Hidden when nothing does. */
export function PortfolioAttention({ rows }: { rows: AttentionRowVm[] }) {
  if (rows.length === 0) return null;
  return (
    <AccountSection id="portfolio-attention" title="Needs your attention">
      <ListCard>
        {rows.map((row) => (
          <ListCardRow
            key={row.key}
            title={row.text}
            subtitle={row.external ? `Opens ${row.productLabel}` : "View details"}
            href={row.href}
          />
        ))}
      </ListCard>
    </AccountSection>
  );
}
