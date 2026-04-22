import { Filter } from "lucide-react";

/** Visual placeholder until filter sheet / advanced filters exist (Figma: FILTER + icon). */
export function SalesFilterLeadChip() {
  return (
    <button
      type="button"
      disabled
      tabIndex={-1}
      aria-disabled
      className="inline-flex h-10 items-center gap-1.5 border-0 border-r border-brand-800 bg-transparent pr-3 font-headline text-sm font-medium uppercase leading-[21px] text-brand-900 dark:border-on-surface/60 dark:text-on-surface"
    >
      <span>Filter</span>
      <Filter className="size-5 shrink-0" strokeWidth={1.5} aria-hidden />
    </button>
  );
}
