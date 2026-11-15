import type { DataRequestRecord } from "@auction/identity-contracts/data-requests";

/**
 * Who last changed a request, from its history (oldest first): the newest entry a named person
 * made. The system's own entries and a person's own download carry no staff name and are passed
 * over. Null when nobody is named.
 */
export function lastEditorName(timeline: DataRequestRecord["timeline"]): string | null {
  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const name = timeline[index]?.actorName?.trim();
    if (name) return name;
  }
  return null;
}

/**
 * The name for a stale-edit notice: the last editor, unless that is the person reading it. A stale
 * write from their own other tab is not "someone else changed it", so no one is named then.
 */
export function otherEditorName(
  timeline: DataRequestRecord["timeline"],
  currentUserName: string | null | undefined,
): string | null {
  const editor = lastEditorName(timeline);
  if (!editor) return null;
  const me = currentUserName?.trim().toLowerCase();
  return me && editor.toLowerCase() === me ? null : editor;
}
