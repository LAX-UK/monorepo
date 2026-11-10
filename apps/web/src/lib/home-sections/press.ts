import { HOME_SECTION_LIMITS } from "@/lib/home-sections/limits";
import type { HomePressItem } from "@/lib/home-sections/types";
import { LONDON_TIME_ZONE, formatDate, toDate } from "@auction/datetime";
import type { PressArchiveEntry } from "@auction/types";

function label(entry: PressArchiveEntry): string {
  const published = toDate(entry.item.publishedAt ?? null);
  const when = published ? ` · ${formatDate(published, LONDON_TIME_ZONE)}` : "";
  return `Coverage · ${entry.item.outletName}${when}`;
}

/** The latest press coverage. `null` below the minimum, so a lone card never sits in a row of three. */
export function buildPress(entries: readonly PressArchiveEntry[]): HomePressItem[] | null {
  const shown = entries.slice(0, HOME_SECTION_LIMITS.press.max).map((entry) => ({
    id: `${entry.sale.id}:${entry.item.url}`,
    href: entry.item.url,
    label: label(entry),
    headline: entry.item.headline,
  }));
  return shown.length >= HOME_SECTION_LIMITS.press.min ? shown : null;
}
