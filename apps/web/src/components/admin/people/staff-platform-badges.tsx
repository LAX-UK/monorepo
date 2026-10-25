import { staffPlatformBadges } from "@/lib/admin/people/staff-access-presenter";
import { EmptyValue, StatusBadge } from "@auction/staff-ui";
import type { LaxStaffAccessProduct } from "@auction/types";

export type StaffPlatformBadgesProps = {
  platforms: readonly { product: LaxStaffAccessProduct; role: string }[] | undefined;
};

/** The LAX platforms a person can use, each with their role there: "Bid · Finance". */
export function StaffPlatformBadges({ platforms }: StaffPlatformBadgesProps) {
  const badges = platforms ? staffPlatformBadges(platforms) : [];
  if (badges.length === 0) return <EmptyValue />;
  return (
    <span className="flex flex-wrap gap-1">
      {badges.map((badge) => (
        <StatusBadge key={badge.product} tone="neutral">
          {badge.label}
        </StatusBadge>
      ))}
    </span>
  );
}
