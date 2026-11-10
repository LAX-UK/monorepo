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

/**
 * Real places that `Intl.supportedValuesOf` lists under only one of their two names (the retired
 * "Asia/Calcutta" or the current "Asia/Kolkata"), depending on the runtime's ICU. Browsers report
 * either, so both are accepted. The list is written out because this package must not use
 * `Intl.DateTimeFormat` to probe names.
 */
const LEGACY_ZONE_ALIASES: ReadonlySet<string> = new Set([
  "Africa/Asmara",
  "Africa/Asmera",
  "Africa/Timbuktu",
  "America/Argentina/Buenos_Aires",
  "America/Argentina/Catamarca",
  "America/Argentina/Cordoba",
  "America/Argentina/Jujuy",
  "America/Argentina/Mendoza",
  "America/Atikokan",
  "America/Atka",
  "America/Buenos_Aires",
  "America/Catamarca",
  "America/Cordoba",
  "America/Ensenada",
  "America/Godthab",
  "America/Indiana/Indianapolis",
  "America/Indianapolis",
  "America/Jujuy",
  "America/Kentucky/Louisville",
  "America/Louisville",
  "America/Mendoza",
  "America/Montreal",
  "America/Nipigon",
  "America/Nuuk",
  "America/Pangnirtung",
  "America/Porto_Acre",
  "America/Rainy_River",
  "America/Santa_Isabel",
  "America/Shiprock",
  "America/Thunder_Bay",
  "America/Virgin",
  "America/Yellowknife",
  "Asia/Calcutta",
  "Asia/Choibalsan",
  "Asia/Chongqing",
  "Asia/Harbin",
  "Asia/Ho_Chi_Minh",
  "Asia/Istanbul",
  "Asia/Kashgar",
  "Asia/Kathmandu",
  "Asia/Katmandu",
  "Asia/Kolkata",
  "Asia/Rangoon",
  "Asia/Saigon",
  "Asia/Tel_Aviv",
  "Asia/Thimbu",
  "Asia/Ujung_Pandang",
  "Asia/Ulan_Bator",
  "Asia/Yangon",
  "Atlantic/Faeroe",
  "Atlantic/Faroe",
  "Atlantic/Jan_Mayen",
  "Australia/Canberra",
  "Australia/Currie",
  "Australia/Yancowinna",
  "Europe/Belfast",
  "Europe/Kiev",
  "Europe/Kyiv",
  "Europe/Nicosia",
  "Europe/Tiraspol",
  "Pacific/Chuuk",
  "Pacific/Johnston",
  "Pacific/Kanton",
  "Pacific/Pohnpei",
  "Pacific/Ponape",
  "Pacific/Samoa",
  "Pacific/Truk",
  "Pacific/Yap",
  "US/Central",
  "US/Eastern",
  "US/Mountain",
  "US/Pacific",
]);

function isValidZone(zone: unknown): zone is string {
  if (typeof zone !== "string" || zone === "") return false;
  return supportedZones().has(zone) || LEGACY_ZONE_ALIASES.has(zone);
}

function isPlaceholderZone(zone: string): boolean {
  return zone === "UTC" || zone === "GMT" || zone.startsWith("Etc/");
}

/** The zone when it names a real place, otherwise `null`. */
export function normalisePlaceZone(zone: unknown): string | null {
  if (!isValidZone(zone) || isPlaceholderZone(zone)) return null;
  return zone;
}
