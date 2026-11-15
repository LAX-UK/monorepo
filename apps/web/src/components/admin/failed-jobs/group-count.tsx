/**
 * "×12" beside a job's name: this many identical failures, across every page. When some are on
 * other pages the row says how many are shown here. `capped` means the count is a lower bound
 * (the group was too large to count in full), so it reads "×12+".
 */
export function GroupCount({
  count,
  onPage = count,
  capped = false,
}: {
  count: number;
  onPage?: number;
  capped?: boolean;
}) {
  const more = capped ? "+" : "";
  const elsewhere = capped || count > onPage;
  const title = capped
    ? `At least ${count} identical failures; the rest are not counted across pages`
    : elsewhere
      ? `${count} identical failures, ${onPage} on this page`
      : undefined;
  return (
    <span
      className="ml-2 inline-flex h-5 shrink-0 items-center rounded-staff-xs border border-staff-line-strong px-1.5 align-middle text-staff-xs font-medium text-staff-muted tabular-nums"
      title={title}
    >
      <span aria-hidden>
        ×{count}
        {more}
      </span>
      <span className="sr-only">
        {" "}
        {capped ? "at least " : ""}
        {count} identical failures{elsewhere ? `, ${onPage} on this page` : ""}
      </span>
    </span>
  );
}
