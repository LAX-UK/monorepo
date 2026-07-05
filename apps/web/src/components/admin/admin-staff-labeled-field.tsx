import type { StaffFacingRef } from "@/lib/admin/staff-facing-ref";

type Props = StaffFacingRef;

/** Human-readable staff field — raw technical values belong in AdminTechnicalIdDisclosure. */
export function AdminStaffLabeledField({ primary, secondary }: Props) {
  return (
    <span className="block">
      <span className="font-medium text-on-surface">{primary}</span>
      {secondary ? (
        <span className="mt-0.5 block text-xs text-on-surface-variant">{secondary}</span>
      ) : null}
    </span>
  );
}
