export function formatEventDateLondon(startsAt: Date): string {
  return startsAt.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

export function formatEventDoorsTimeLondon(startsAt: Date): string {
  const time = startsAt.toLocaleString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
  return `Doors ${time}`;
}

export function formatEventDateTimeLondon(iso: string | null): string | null {
  if (!iso) return null;
  const startsAt = new Date(iso);
  if (Number.isNaN(startsAt.getTime())) return null;
  return `${formatEventDateLondon(startsAt)} · ${formatEventDoorsTimeLondon(startsAt).replace(/^Doors /, "")}`;
}
