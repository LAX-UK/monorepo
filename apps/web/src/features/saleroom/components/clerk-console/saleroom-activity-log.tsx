import {
  ConsolePanel,
  PanelHeading,
} from "@/features/saleroom/components/clerk-console/console-panel";
import type { SaleroomActivityEntry } from "@/features/saleroom/types/staff-saleroom.vm";
import { formatDateTime, formatRelativeTime } from "@/lib/ui/format";

type Props = {
  entries: SaleroomActivityEntry[];
};

export function SaleroomActivityLog({ entries }: Props) {
  return (
    <ConsolePanel>
      <PanelHeading>Activity log</PanelHeading>
      <ul
        className="mt-3 max-h-64 space-y-2 overflow-y-auto font-body text-xs text-secondary transition-opacity duration-200"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Saleroom activity"
      >
        {entries.length === 0 ? (
          <li>Waiting for events…</li>
        ) : (
          entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-baseline gap-2">
              <span className="font-medium text-foreground">{entry.label}</span>
              {entry.detail ? <span className="opacity-80">{entry.detail}</span> : null}
              <span className="opacity-60 tabular-nums" title={formatDateTime(entry.occurredAt)}>
                {formatRelativeTime(entry.occurredAt)}
              </span>
            </li>
          ))
        )}
      </ul>
    </ConsolePanel>
  );
}
