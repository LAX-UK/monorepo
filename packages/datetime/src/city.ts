/** "America/New_York" becomes "New York"; "America/Argentina/Buenos_Aires" becomes "Buenos Aires". */
export function cityName(zone: string): string {
  const last = zone.split("/").pop() ?? zone;
  return last.replaceAll("_", " ");
}
