/**
 * "×12" beside a job's name: this many identical failures, across every page. When some are on
 * other pages the row says how many are shown here.
 */
export function GroupCount({ count, onPage = count }: { count: number; onPage?: number }) {
  const elsewhere = count > onPage;
  return (
    <span
      className="ml-2 inline-flex h-5 shrink-0 items-center rounded-staff-xs border border-staff-line-strong px-1.5 align-middle text-staff-xs font-medium text-staff-muted tabular-nums"
      title={elsewhere ? `${count} identical failures, ${onPage} on this page` : undefined}
    >
      <span aria-hidden>×{count}</span>
      <span className="sr-only">
        {" "}
        {count} identical failures{elsewhere ? `, ${onPage} on this page` : ""}
      </span>
    </span>
  );
}
