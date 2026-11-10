import { timesAreInLabel } from "@auction/datetime";

/**
 * The one line that says which clock a form's times are on: "Times are in London time
 * (GMT/BST)." Shown once above the times, so the inputs themselves carry no zone name.
 */
export function TimesZoneNote({ zone, className }: { zone: string; className?: string }) {
  return (
    <p className={className ?? "text-staff-sm text-staff-muted"}>
      {timesAreInLabel(zone, new Date())}.
    </p>
  );
}
