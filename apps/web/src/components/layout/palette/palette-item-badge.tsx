"use client";

import { AdminQueueCountBadge } from "@/components/admin/admin-status-badge";
import type { PaletteItem } from "@/components/layout/palette/types";
import { StatusBadge } from "@auction/ui";

export function PaletteItemBadge({ item }: { item: PaletteItem }) {
  const count = item.badge ?? 0;
  if (count <= 0) return null;

  if (item.badgeTone === "live") {
    return (
      <StatusBadge variant="live" size="sm" dot>
        Live
      </StatusBadge>
    );
  }

  if (item.badgeTone === "danger") {
    return (
      <StatusBadge variant="danger" size="sm">
        {count}
      </StatusBadge>
    );
  }

  return <AdminQueueCountBadge count={count} />;
}
