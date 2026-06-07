import { SELL_PREREQUISITES } from "@/lib/marketing/sell-flow-copy";
import { Circle } from "lucide-react";

/** Compact checklist for wizard step 1. */
export function SellPrerequisitesInline() {
  return (
    <ul className="space-y-2 rounded-lg border border-border-hairline bg-surface-container-low/60 p-4">
      {SELL_PREREQUISITES.slice(0, 4).map((item) => (
        <li key={item} className="flex gap-2 font-body text-xs text-on-surface-variant">
          <Circle className="mt-0.5 size-3 shrink-0 text-primary" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
