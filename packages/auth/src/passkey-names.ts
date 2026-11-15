/** The longest name suggested for a passkey; the person can keep it or write their own. */
export const SUGGESTED_PASSKEY_NAME_MAX_LENGTH = 40;

/** Who keeps a passkey, as far as its authenticator's AAGUID says. */
export type PasskeyProviderId =
  | "apple"
  | "google"
  | "windows_hello"
  | "security_key"
  | "onepassword"
  | "bitwarden"
  | "dashlane"
  | "unknown";

/**
 * Well-known public authenticator AAGUIDs and who keeps the passkey. No lookups: an authenticator
 * that is not listed (or that reports no identity, which Apple does when no attestation is asked
 * for) is "unknown".
 */
const AUTHENTICATOR_PROVIDERS: Readonly<Record<string, Exclude<PasskeyProviderId, "unknown">>> = {
  "fbfc3007-154e-4ecc-8c0b-6e020557d7bd": "apple", // gitleaks:allow
  "dd4ec289-e01d-41c9-bb89-70fa845d4bf2": "apple", // gitleaks:allow
  "ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4": "google", // gitleaks:allow
  "08987058-cadc-4b81-b6e1-30de50dcbe96": "windows_hello", // gitleaks:allow
  "9ddd1817-af5a-4672-a2b9-3e3dd95000a9": "windows_hello", // gitleaks:allow
  "6028b017-b1d4-4c02-b4b3-afcdafc96bb2": "windows_hello", // gitleaks:allow
  "bada5566-a7aa-401f-bd96-45619a55120d": "onepassword", // gitleaks:allow
  "d548826e-79b4-db40-a3d8-11116f7e8349": "bitwarden", // gitleaks:allow
  "531126d6-e717-415c-9320-3d9aa6981239": "dashlane", // gitleaks:allow
  "2fc0579f-8113-47ea-b116-bb5a8db9202a": "security_key", // gitleaks:allow
  "f8a011f3-8c0a-4d15-8006-17111f9edc7d": "security_key", // gitleaks:allow
  "cb69481e-8ff7-4039-93ec-0a2729a154a8": "security_key", // gitleaks:allow
};

/** The words the person knows each provider by. */
const PROVIDER_NAMES: Readonly<Record<Exclude<PasskeyProviderId, "unknown">, string>> = {
  apple: "iCloud Keychain",
  google: "Google Password Manager",
  windows_hello: "Windows Hello",
  security_key: "Security key",
  onepassword: "1Password",
  bitwarden: "Bitwarden",
  dashlane: "Dashlane",
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

/** Who keeps the passkey made by this authenticator; "unknown" when it is not listed or silent. */
export function passkeyProviderFromAaguid(aaguid: string | null | undefined): PasskeyProviderId {
  const key = aaguid?.trim().toLowerCase();
  if (!key || key === NO_AUTHENTICATOR_IDENTITY) return "unknown";
  return AUTHENTICATOR_PROVIDERS[key] ?? "unknown";
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
  const provider = passkeyProviderFromAaguid(input.aaguid);
  if (provider !== "unknown") return PROVIDER_NAMES[provider];
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
