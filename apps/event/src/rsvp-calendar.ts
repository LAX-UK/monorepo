import { DEFAULT_EVENT_SLUG, resolveEventSlug } from "./config.js";

function escapeIcsText(s: string): string {
  return s.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,");
}

function formatIcsUtc(d: Date): string {
  return `${d.toISOString().replaceAll(/[-:]/g, "").slice(0, 15)}Z`;
}

export function downloadOpeningEventCalendar(segment = "full_evening"): void {
  const start =
    segment === "gala_only"
      ? new Date("2026-06-18T19:00:00.000Z")
      : new Date("2026-06-18T17:00:00.000Z");
  const end =
    segment === "gala_only"
      ? new Date("2026-06-18T23:30:00.000Z")
      : segment === "auction_only"
        ? new Date("2026-06-18T19:00:00.000Z")
        : new Date("2026-06-19T00:30:00.000Z");

  const slug = resolveEventSlug() ?? DEFAULT_EVENT_SLUG;
  const uid = `${slug}-opening@lax.bid`;
  const dtStamp = formatIcsUtc(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LAX.BID//Opening Event//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${formatIcsUtc(start)}`,
    `DTEND:${formatIcsUtc(end)}`,
    `SUMMARY:${escapeIcsText("LAX 001: The First Hammer")}`,
    `DESCRIPTION:${escapeIcsText("London Auction Exchange opening — Brunswick Art Gallery, London.")}`,
    `LOCATION:${escapeIcsText("Brunswick Art Gallery & Centre, London")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "LAX-001-opening.ics";
  anchor.click();
  URL.revokeObjectURL(url);
}
