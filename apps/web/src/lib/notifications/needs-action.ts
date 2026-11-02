import { type NeedsYouRowView, needsYouRowView } from "@/lib/organisation-home/needs-you-view";
import type { NeedsYouResponse } from "@/lib/workspace/needs-you-read";

/**
 * Notifications › Needs action, from the one Needs-you reader Home and the sidebar counts read:
 * the account's tasks as rows, ranked as the reader ranks them. `failed` is the reader not
 * answering, which is said, never shown as "nothing needs you".
 */
export type NeedsActionView = {
  /** The account the tasks are for: the one in use. */
  account: { kind: "personal" | "organisation"; name: string; initials: string };
  rows: readonly NeedsYouRowView[];
  failed: boolean;
};

export function needsActionRows(
  response: NeedsYouResponse | null,
  ctx: { organisationName: string; now: Date },
): Pick<NeedsActionView, "rows" | "failed"> {
  if (!response) return { rows: [], failed: true };
  return { rows: response.tasks.map((task) => needsYouRowView(task, ctx)), failed: false };
}

/** The rows a search keeps: its words found in the title or the detail. */
export function searchNeedsAction(
  rows: readonly NeedsYouRowView[],
  query: string,
): readonly NeedsYouRowView[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return rows;
  return rows.filter((row) => {
    const text = `${row.title} ${row.detail}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
