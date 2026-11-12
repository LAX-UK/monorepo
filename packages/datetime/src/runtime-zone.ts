/** The zone the runtime itself runs in (a browser's, or a server's `TZ`), unnormalised. */
export function runtimeTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}
