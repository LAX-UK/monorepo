import { errorCopy } from "@/lib/forms/error-copy";
import { visibleSellDepartmentGroups } from "@/lib/marketing/sell-departments";
import { parsePoundsToPence } from "@auction/ui";
import { z } from "zod";

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

const PHONE = /^\+?[\d\s().-]{6,}$/;

const flat = z.object({
  path: z.enum(["sell", "buy"]),
  departmentSlug: z.string(),
  artist: z.string().max(200, errorCopy.maxLength(200)),
  title: z.string().max(300, errorCopy.maxLength(300)),
  mediumSize: z.string().max(200, errorCopy.maxLength(200)),
  location: z.string().max(240, errorCopy.maxLength(240)),
  price: z.string(),
  priceNotSure: z.boolean(),
  lookingFor: z.string().max(2000, errorCopy.maxLength(2000)),
  budgetBand: z.string(),
  timing: z.string(),
  notes: z.string().max(5000, errorCopy.maxLength(5000, "your notes")),
  name: z
    .string()
    .trim()
    .min(1, errorCopy.required("your name"))
    .max(120, errorCopy.maxLength(120, "your name")),
  email: z.string().trim().min(1, errorCopy.email).email(errorCopy.email),
  phone: z.string().trim(),
  contactPreference: z.enum(["email", "phone", "either"]),
  marketingOptIn: z.boolean(),
  website: z.string(),
});

/** The sender's answers, checked for the path they chose; the other path's fields are not asked. */
export const enquiryFormSchema = flat.superRefine((values, ctx) => {
  const fail = (path: keyof EnquiryFormValues, message: string) =>
    ctx.addIssue({ code: "custom", path: [path], message });

  if (values.path === "sell") {
    if (!values.departmentSlug) fail("departmentSlug", errorCopy.requiredChoice("a department"));
    if (!values.artist.trim()) fail("artist", 'Enter the artist or maker, or "Unknown"');
    if (!values.title.trim()) fail("title", "Enter a title or short description");
    if (!values.location.trim()) {
      fail("location", "Enter where the work is now, like London, UK");
    } else if (!parseLocation(values.location)) {
      fail("location", "Enter the town and country, like London, UK");
    }
    if (!values.priceNotSure && parsePriceInMindMinor(values.price) === null) {
      fail("price", "Enter an amount in pounds, like 45,000");
    }
  } else {
    if (values.lookingFor.trim().length < 3) fail("lookingFor", "Tell us what you are looking for");
    if (!budgetOptions.some((o) => o.value === values.budgetBand)) {
      fail("budgetBand", errorCopy.requiredChoice("a budget"));
    }
    if (!timingOptions.some((o) => o.value === values.timing)) {
      fail("timing", errorCopy.requiredChoice("a timing"));
    }
  }

  const phone = values.phone.trim();
  if (phone && !PHONE.test(phone)) {
    fail("phone", errorCopy.phone);
  } else if (!phone && values.contactPreference !== "email") {
    fail("phone", "Enter a phone number so we can call you");
  }
});
