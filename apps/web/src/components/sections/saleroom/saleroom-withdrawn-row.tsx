import type { WithdrawnRowVM } from "@/lib/marketing/saleroom/catalogue-rows";
import { cn } from "@auction/ui";

type Props = {
  row: WithdrawnRowVM;
  /** `grid`: a bordered slim bar between tiles. `list`: a plain row between hairlines. */
  layout: "grid" | "list";
};

/**
 * A withdrawn lot in the catalogue, as a printed catalogue keeps it: the number, the word and the
 * title, so the numbering has no gap. It carries no image, price or link; the work is not on offer.
 */
export function SaleroomWithdrawnRow({ row, layout }: Props) {
  return (
    <article
      className={cn(
        "flex min-w-0 flex-col gap-0.5",
        layout === "grid" ? "rounded-md border border-outline-variant/40 px-4 py-3" : "py-4",
      )}
      aria-label={`${row.lotLabel ? `${row.lotLabel}, ` : ""}withdrawn: ${row.title}`}
    >
      <p className="font-label text-xs font-medium text-on-surface-variant">
        {[row.lotLabel, "Withdrawn"].filter(Boolean).join(" · ")}
      </p>
      <p className="line-clamp-1 text-sm text-on-surface-variant">{row.title}</p>
    </article>
  );
}
