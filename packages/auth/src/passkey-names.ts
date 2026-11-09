/** The longest name suggested for a passkey; the person can keep it or write their own. */
export const SUGGESTED_PASSKEY_NAME_MAX_LENGTH = 40;

/**
 * Well-known authenticators by their AAGUID, in the words the person knows them by. A passkey
 * made by an authenticator that is not listed (or that reports no identity, which Apple does when
 * no attestation is asked for) gets a name from the browser and system instead.
 */
const AUTHENTICATOR_NAMES: Readonly<Record<string, string>> = {
  "fbfc3007-154e-4ecc-8c0b-6e020557d7bd": "iCloud Keychain",
  "dd4ec289-e01d-41c9-bb89-70fa845d4bf2": "iCloud Keychain",
  "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4": "Google Password Manager",
  "08987058-cadc-4b81-b6e1-30de50dcbe96": "Windows Hello",
  "9ddd1817-af5a-4672-a2b9-3e3dd95000a9": "Windows Hello",
  "6028b017-b1d4-4c02-b4b3-afcdafc96bb2": "Windows Hello",
  "bada5566-a7aa-401f-bd96-45619a55120d": "1Password",
  "d548826e-79b4-db40-a3d8-11116f7e8349": "Bitwarden",
  "2fc0579f-8113-47ea-b116-bb5a8db9202a": "Security key",
  "f8a011f3-8c0a-4d15-8006-17111f9edc7d": "Security key",
  "cb69481e-8ff7-4039-93ec-0a2729a154a8": "Security key",
};

const NO_AUTHENTICATOR_IDENTITY = "00000000-0000-0000-0000-000000000000";

const BROWSERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: ReadonlyArray<readonly [RegExp, string]> = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

function firstMatch(table: ReadonlyArray<readonly [RegExp, string]>, text: string): string | null {
  return table.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

/**
 * A name for a new passkey, so the list in Security can tell them apart: the authenticator when
 * it is a well-known one, otherwise "Passkey on <browser> on <system>", otherwise "Passkey".
 * Never longer than {@link SUGGESTED_PASSKEY_NAME_MAX_LENGTH}.
 */
export function suggestPasskeyName(input: {
  aaguid?: string | null | undefined;
  userAgent?: string | null | undefined;
}): string {
  const aaguid = input.aaguid?.trim().toLowerCase();
  const known = aaguid && aaguid !== NO_AUTHENTICATOR_IDENTITY ? AUTHENTICATOR_NAMES[aaguid] : null;
  if (known) return known;
  const agent = input.userAgent ?? "";
  const browser = firstMatch(BROWSERS, agent);
  const system = firstMatch(SYSTEMS, agent);
  const name =
    browser && system
      ? `Passkey on ${browser} on ${system}`
      : browser
        ? `Passkey on ${browser}`
        : "Passkey";
  return name.slice(0, SUGGESTED_PASSKEY_NAME_MAX_LENGTH);
}
