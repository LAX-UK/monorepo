import type { OpeningHoursRow } from "@/lib/editorial/editorial-pages.composer";

const LONDON_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * An exhibition has ended once its last day (a calendar date, no time) is before today in London,
 * so the end date itself is still open and the show reads as closed from London midnight, in both
 * GMT and BST. The clock is injected so callers stay deterministic.
 */
export function exhibitionHasEnded(endsOn: string | null, now: Date): boolean {
  if (!endsOn || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) return false;
  return endsOn < LONDON_DATE.format(now);
}

/** "Exhibition · 18 Aug – 27 Aug 2026"; the kind alone when undated. */
export function exhibitionMetaLine(leadLabel: string, dateLabel: string | null): string {
  return dateLabel ? `${leadLabel} · ${dateLabel}` : leadLabel;
}

/** "Opening hours: Tue – Sat 10:00 – 18:00 · Sun 12:00 – 17:00"; null without hours. */
export function openingHoursLine(rows: readonly OpeningHoursRow[]): string | null {
  if (rows.length === 0) return null;
  const hours = rows
    .map((row) => (row.label === "Opening hours" ? row.value : `${row.label} ${row.value}`))
    .join(" · ");
  return `Opening hours: ${hours}`;
}

/** Address then hours, each only when known. */
export function venueMetaLines(
  addressLine: string | null,
  hours: readonly OpeningHoursRow[],
): string[] {
  return [addressLine, openingHoursLine(hours)].filter((line): line is string => Boolean(line));
}

export type PageSectionTab = { id: string; label: string };

/** Sub-navigation tabs for the exhibition sections that render; none when fewer than two. */
export function exhibitionSectionTabs(sections: {
  overview: boolean;
  works: boolean;
  artists: boolean;
  press: boolean;
}): PageSectionTab[] {
  const tabs = [
    sections.overview ? { id: "overview", label: "Overview" } : null,
    sections.works ? { id: "works", label: "Works" } : null,
    sections.artists ? { id: "featured-artists", label: "Featured artists" } : null,
    sections.press ? { id: "press", label: "Press" } : null,
  ].filter((tab): tab is PageSectionTab => tab != null);
  return tabs.length > 1 ? tabs : [];
}
