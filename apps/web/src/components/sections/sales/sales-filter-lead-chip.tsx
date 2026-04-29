import { Button } from "@auction/ui/components/button";
import { Filter } from "lucide-react";

/** Visual placeholder until filter sheet / advanced filters exist (Figma: FILTER + icon). */
export function SalesFilterLeadChip() {
  return (
    <Button
      type="button"
      variant="ghost"
      disabled
      tabIndex={-1}
      aria-disabled
      className="inline-flex h-10 items-center gap-1.5 rounded-none border-0 border-r border-brand-800 bg-transparent pr-3 font-headline text-sm font-medium uppercase leading-[21px] text-brand-900 hover:bg-transparent dark:border-on-surface/60 dark:text-on-surface"
    >
      <span>Filter</span>
      <Filter className="size-5 shrink-0" strokeWidth={1.5} aria-hidden />
    </Button>
  );
}
