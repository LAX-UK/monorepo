/**
 * The rule for a time zone that names a real place, as LAX applies it everywhere a person's zone
 * is stored or shown: an IANA name the runtime can compute with, never UTC, GMT or an `Etc/*`
 * fixed offset (privacy modes report those on purpose, and they name no place).
 *
 * This is the same rule as `normaliseViewerZone` in `@auction/datetime`. Identity cannot import
 * that package (it must stay extractable), so the rule is written out here and a parity test in
 * LAX Account, which sees both, keeps the two from drifting.
 */

let supported: ReadonlySet<string> | undefined;

function supportedZones(): ReadonlySet<string> {
  supported ??= new Set(Intl.supportedValuesOf("timeZone"));
  return supported;
}

/** Older browsers still report retired aliases ("Asia/Calcutta"); the runtime resolves them. */
function runtimeAcceptsZone(zone: string): boolean {
  if (!zone.includes("/")) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function isValidZone(zone: unknown): zone is string {
  if (typeof zone !== "string" || zone === "") return false;
  return supportedZones().has(zone) || runtimeAcceptsZone(zone);
}

function isPlaceholderZone(zone: string): boolean {
  return zone === "UTC" || zone === "GMT" || zone.startsWith("Etc/");
}

/** The zone when it names a real place, otherwise `null`. */
export function normalisePlaceZone(zone: unknown): string | null {
  if (!isValidZone(zone) || isPlaceholderZone(zone)) return null;
  return zone;
}
