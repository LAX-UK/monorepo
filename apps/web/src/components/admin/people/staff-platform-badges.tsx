import { staffPlatformBadges } from "@/lib/admin/people/staff-access-presenter";
import type { LaxStaffAccessProduct } from "@auction/types";

export type StaffPlatformBadgesProps = {
  platforms: readonly { product: LaxStaffAccessProduct; role: string }[] | undefined;
};

export function StaffPlatformBadges({ platforms }: StaffPlatformBadgesProps) {
  const badges = platforms ? staffPlatformBadges(platforms) : [];
  if (badges.length === 0) {
    return <span className="text-xs text-on-surface-variant">—</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {badges.map((badge) => (
        <span
          key={badge.product}
          className="rounded-full border border-border-hairline px-2 py-0.5 text-[11px] text-on-surface"
        >
          {badge.label}
        </span>
      ))}
    </span>
  );
}
