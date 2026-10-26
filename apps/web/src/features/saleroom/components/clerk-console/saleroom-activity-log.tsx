import {
  ConsolePanel,
  PanelHeading,
} from "@/features/saleroom/components/clerk-console/console-panel";
import type { SaleroomActivityEntry } from "@/features/saleroom/types/staff-saleroom.vm";
import { formatStaffDateTime, formatStaffRelative } from "@auction/staff-ui";

type Props = {
  entries: SaleroomActivityEntry[];
  panelVariant?: "bordered" | "plain";
};

/** What has happened in the room, newest first, as it arrives. */
export function SaleroomActivityLog({ entries, panelVariant = "bordered" }: Props) {
  return (
    <ConsolePanel variant={panelVariant}>
      <PanelHeading>Activity</PanelHeading>
      <div
        // The list scrolls on its own, so a keyboard has to be able to reach it.
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be focusable
        tabIndex={0}
        className="staff-focus mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto rounded-staff-xs text-staff-sm text-staff-muted"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Saleroom activity"
      >
        {entries.length === 0 ? (
          <p>Waiting for events…</p>
        ) : (
          entries.map((entry) => (
            <p key={entry.id} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-staff-fg">{entry.label}</span>
              {entry.detail ? <span>{entry.detail}</span> : null}
              <span
                className="tabular-nums"
                title={formatStaffDateTime(entry.occurredAt, { zoneLabel: true })}
              >
                {formatStaffRelative(entry.occurredAt)}
              </span>
            </p>
          ))
        )}
      </div>
    </ConsolePanel>
  );
}
