"use client";

import { AdminQueueCountBadge } from "@/components/admin/admin-status-badge";
import type { PaletteItem } from "@/components/layout/palette/types";
import { CountPill, LiveBadge } from "@auction/ui";

export function PaletteItemBadge({ item }: { item: PaletteItem }) {
  const count = item.badge ?? 0;
  if (count <= 0) return null;

  if (item.badgeTone === "live") return <LiveBadge />;
  if (item.badgeTone === "danger") return <CountPill value={count} tone="attention" />;
  return <AdminQueueCountBadge count={count} />;
}
