import type { DataRequestRecord } from "@auction/identity-contracts/data-requests";
import { formatMoment } from "./data-requests.vm";

/** When and how a copy of the person's data already went out, as the record's history shows it. */
export type SentCopy = {
  /** "3 Oct, 14:05": when the copy was ready for the person. */
  on: string;
  /** How it reached them. */
  how: string;
  downloads: number;
  /** "15 Oct, 14:05" while the link still works; null once it has gone. */
  until: string | null;
};

/**
 * The copy a request already has: the secure download LAX Account built, ready since the moment
 * the history records. Null when none was built, so the dialog says nothing it does not know.
 */
export function sentCopyOf(
  record: Pick<DataRequestRecord, "file" | "timeline">,
  now: Date,
): SentCopy | null {
  const { file } = record;
  if (!file) return null;
  const ready = [...record.timeline].reverse().find((entry) => entry.event === "data_export.ready");
  if (!ready) return null;
  // Full timestamps, not dates: on the last day the link stops working at the hour it expires.
  const live = file.expiresAt !== null && new Date(file.expiresAt).getTime() > now.getTime();
  return {
    on: formatMoment(ready.at),
    how: "A secure download in LAX Account",
    downloads: file.downloadCount,
    until: live && file.expiresAt ? formatMoment(file.expiresAt) : null,
  };
}
