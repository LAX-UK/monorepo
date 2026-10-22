export function formatAdminDetailGbpPence(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

/**
 * Shown in London time wherever it renders. Without a fixed zone the server and the browser can
 * disagree, which both mislabels the time and breaks hydration of client components.
 */
export function formatAdminDetailDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
}
