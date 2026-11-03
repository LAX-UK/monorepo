/** "×3" beside a job's name: this many identical failures are folded into the row. */
export function GroupCount({ count }: { count: number }) {
  return (
    <span className="ml-2 inline-flex h-5 shrink-0 items-center rounded-staff-xs border border-staff-line-strong px-1.5 align-middle text-staff-xs font-medium text-staff-muted tabular-nums">
      <span aria-hidden>×{count}</span>
      <span className="sr-only"> {count} identical failures</span>
    </span>
  );
}
