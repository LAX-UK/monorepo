import { SELL_PREREQUISITES } from "@/lib/marketing/sell-flow-copy";

/**
 * What to have to hand, on step 1: a list with small bullets. Not circles, which read as choices
 * to tick.
 */
export function SellPrerequisitesInline() {
  return (
    <ul className="space-y-2 rounded-lg border border-border-hairline bg-surface-container-low/60 p-4">
      {SELL_PREREQUISITES.slice(0, 4).map((item) => (
        <li
          key={item}
          className="flex gap-2.5 font-body text-label-3 leading-5 text-on-surface-variant"
        >
          <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-on-surface-variant" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
