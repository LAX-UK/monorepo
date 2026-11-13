import { visibleSellDepartmentGroups } from "@/lib/marketing/sell-departments";
import { parsePoundsToPence } from "@auction/ui/lib/money";

export type EnquiryPath = "sell" | "buy";

export const ENQUIRY_PATH_OPTIONS = [
  { value: "sell", label: "Sell privately" },
  { value: "buy", label: "Buy privately" },
] as const satisfies readonly { value: EnquiryPath; label: string }[];

export function isEnquiryPath(value: unknown): value is EnquiryPath {
  return value === "sell" || value === "buy";
}

export type Option<T extends string> = { value: T; label: string };

/** The public Sell departments, by the slug routing uses. */
export function departmentOptions(): Option<string>[] {
  const seen = new Set<string>();
  const options: Option<string>[] = [];
  for (const group of visibleSellDepartmentGroups()) {
    for (const department of group.departments) {
      if (!department.slug || seen.has(department.slug)) continue;
      seen.add(department.slug);
      options.push({ value: department.slug, label: department.label });
    }
  }
  return options;
}

export const budgetOptions = [
  { value: "under_10000", label: "Under £10,000" },
  { value: "10000_to_50000", label: "£10,000 to £50,000" },
  { value: "50000_to_250000", label: "£50,000 to £250,000" },
  { value: "over_250000", label: "Over £250,000" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const satisfies readonly Option<string>[];

export const timingOptions = [
  { value: "no_rush", label: "No rush" },
  { value: "within_3_months", label: "Within 3 months" },
  { value: "urgent", label: "Urgent" },
] as const satisfies readonly Option<string>[];

export const contactPreferenceOptions = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "either", label: "Email or phone" },
] as const satisfies readonly Option<string>[];

/** "London, UK" as a town and a country: the last comma splits them. */
export function parseLocation(text: string): { town: string; country: string } | null {
  const at = text.lastIndexOf(",");
  if (at < 0) return null;
  const town = text.slice(0, at).trim();
  const country = text.slice(at + 1).trim();
  return town && country ? { town, country } : null;
}

/**
 * A price in pounds as pence: `undefined` when none was typed, `null` when what was typed is not
 * an amount. Commas and a leading £ are allowed; more than two decimals are not.
 */
export function parsePriceInMindMinor(text: string): number | null | undefined {
  const parsed = parsePoundsToPence(text);
  if (!parsed.ok) return parsed.reason === "empty" ? undefined : null;
  return parsed.pence > 0 ? parsed.pence : null;
}

/** Everything either path asks, held flat so switching paths keeps what was typed. */
export type EnquiryFormValues = {
  path: EnquiryPath;
  departmentSlug: string;
  artist: string;
  title: string;
  mediumSize: string;
  location: string;
  price: string;
  priceNotSure: boolean;
  lookingFor: string;
  budgetBand: string;
  timing: string;
  notes: string;
  name: string;
  email: string;
  phone: string;
  contactPreference: string;
  marketingOptIn: boolean;
  /** A honeypot: people never see it. */
  website: string;
};

export function emptyEnquiryValues(path: EnquiryPath): EnquiryFormValues {
  return {
    path,
    departmentSlug: "",
    artist: "",
    title: "",
    mediumSize: "",
    location: "",
    price: "",
    priceNotSure: false,
    lookingFor: "",
    budgetBand: "",
    timing: "no_rush",
    notes: "",
    name: "",
    email: "",
    phone: "",
    contactPreference: "email",
    marketingOptIn: false,
    website: "",
  };
}
