import type { DetailAttentionRow } from "@/lib/admin/detail-board/types";
import type { IssueItem } from "@auction/staff-ui";

const TONE = {
  critical: "danger",
  high: "warning",
  medium: "warning",
  low: "neutral",
} as const satisfies Record<DetailAttentionRow["severity"], IssueItem["tone"]>;

/** A record's attention rows as kit issues: severity as tone, category as the tag. */
export function toIssueItems(rows: readonly DetailAttentionRow[]): IssueItem[] {
  return rows.map((row) => ({
    id: row.id,
    label: row.title,
    tone: TONE[row.severity],
    tag: row.category,
    ...(row.href ? { action: { label: row.actionLabel, href: row.href } } : {}),
  }));
}
