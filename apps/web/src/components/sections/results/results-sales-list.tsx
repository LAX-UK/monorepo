import { ResultsSaleRow } from "@/components/sections/results/results-sale-row";
import { RESULTS_SORT_LABEL, type ResultsRowVM } from "@/lib/marketing/results-page.vm";

/** Sales with results, in the order the line above them says. */
export function ResultsSalesList({ rows }: { rows: readonly ResultsRowVM[] }) {
  return (
    <section aria-label="Sales with results" className="flex flex-col gap-4">
      <p className="text-lax-14 text-lax-muted">{RESULTS_SORT_LABEL}</p>
      <ul className="flex flex-col gap-4">
        {rows.map((row) => (
          <ResultsSaleRow key={row.id} row={row} />
        ))}
      </ul>
    </section>
  );
}
