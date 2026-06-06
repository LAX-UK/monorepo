import type { PaletteItem, PaletteSection } from "@/components/layout/palette/types";
import type { StaffNavGroupSpec } from "@/components/layout/staff-nav";

export function mapStaffNavGroupsToPaletteSections(
  groups: readonly StaffNavGroupSpec[],
): PaletteSection[] {
  return groups.map((group) => ({
    id: group.id,
    heading: group.title,
    items: group.items.map((item) => {
      const paletteItem: PaletteItem = {
        id: `sn-${item.id}`,
        href: item.href,
        label: item.label,
        icon: item.icon,
        kind: "page",
        hint: group.title,
      };
      if (item.badge !== undefined) {
        paletteItem.badge = item.badge;
      }
      if (item.badgeTone !== undefined) {
        paletteItem.badgeTone = item.badgeTone;
      }
      return paletteItem;
    }),
  }));
}
