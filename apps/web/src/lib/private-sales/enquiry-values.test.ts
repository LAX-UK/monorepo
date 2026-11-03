import { describe, expect, it } from "vitest";
import {
  type EnquiryFormValues,
  budgetOptions,
  contactPreferenceOptions,
  departmentOptions,
  emptyEnquiryValues,
  enquiryFormSchema,
  parseLocation,
  parsePriceInMindMinor,
  timingOptions,
} from "./enquiry-values";

const sell = (over: Partial<EnquiryFormValues> = {}): EnquiryFormValues => ({
  ...emptyEnquiryValues("sell"),
  departmentSlug: "paintings",
  artist: "Iris Calder",
  title: "Low tide at Maldon",
  location: "London, UK",
  name: "Daniel Price",
  email: "daniel.price@example.com",
  ...over,
});

const buy = (over: Partial<EnquiryFormValues> = {}): EnquiryFormValues => ({
  ...emptyEnquiryValues("buy"),
  lookingFor: "A mid-century British landscape",
  budgetBand: "10000_to_50000",
  name: "Charlotte Hale",
  email: "charlotte@marlow.example",
  ...over,
});

function messages(values: EnquiryFormValues): Record<string, string> {
  const result = enquiryFormSchema.safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path.join("."), i.message]));
}

describe("departmentOptions", () => {
  it("lists the public Sell departments, each with the slug used for routing", () => {
    const options = departmentOptions();
    expect(options).toContainEqual({ value: "paintings", label: "Paintings" });
    expect(options).toContainEqual({ value: "watches-clocks", label: "Watches & clocks" });
    // Departments hidden from the Sell page are not offered.
    expect(options.map((o) => o.value)).not.toContain("jewellery");
    expect(new Set(options.map((o) => o.value)).size).toBe(options.length);
  });
});

describe("option tables", () => {
  it("offer the budget bands and timings the API takes, in the words clients use", () => {
    expect(budgetOptions.map((o) => o.value)).toEqual([
      "under_10000",
      "10000_to_50000",
      "50000_to_250000",
      "over_250000",
      "prefer_not_to_say",
    ]);
    expect(budgetOptions[1]?.label).toBe("£10,000 to £50,000");
    expect(timingOptions.map((o) => o.label)).toEqual(["No rush", "Within 3 months", "Urgent"]);
    expect(contactPreferenceOptions.map((o) => o.label)).toEqual([
      "Email",
      "Phone",
      "Email or phone",
    ]);
  });
});

describe("parseLocation", () => {
  it.each([
    ["London, UK", { town: "London", country: "UK" }],
    ["  Bath ,  United Kingdom ", { town: "Bath", country: "United Kingdom" }],
    ["Saint-Denis, Réunion, France", { town: "Saint-Denis, Réunion", country: "France" }],
  ])("reads %j as town and country", (text, expected) => {
    expect(parseLocation(text)).toEqual(expected);
  });

  it.each(["London", "", ", UK", "London,"])("cannot read %j", (text) => {
    expect(parseLocation(text)).toBeNull();
  });
});

describe("parsePriceInMindMinor", () => {
  it.each([
    ["45,000", 4_500_000],
    ["£45,000", 4_500_000],
    ["45000.50", 4_500_050],
    [" 1,250 ", 125_000],
  ])("reads %j as pence", (text, pence) => {
    expect(parsePriceInMindMinor(text)).toBe(pence);
  });

  it.each(["", "   "])("treats %j as no price", (text) => {
    expect(parsePriceInMindMinor(text)).toBeUndefined();
  });

  it.each(["abc", "0", "-5", "12.345", "1e5"])("cannot read %j", (text) => {
    expect(parsePriceInMindMinor(text)).toBeNull();
  });
});

describe("enquiryFormSchema, selling", () => {
  it("accepts a complete seller's form", () => {
    expect(messages(sell())).toEqual({});
  });

  it("asks for what only the seller's path needs", () => {
    expect(messages(sell({ departmentSlug: "", artist: "", title: "", location: "" }))).toEqual({
      departmentSlug: "Choose a department",
      artist: 'Enter the artist or maker, or "Unknown"',
      title: "Enter a title or short description",
      location: "Enter where the work is now, like London, UK",
    });
  });

  it("asks for a town and a country", () => {
    expect(messages(sell({ location: "London" })).location).toBe(
      "Enter the town and country, like London, UK",
    );
  });

  it("checks a price when one is given, and ignores it once the seller is not sure", () => {
    expect(messages(sell({ price: "lots" })).price).toBe("Enter an amount in pounds, like 45,000");
    expect(messages(sell({ price: "lots", priceNotSure: true }))).toEqual({});
  });

  it("does not ask the seller path for the buyer's answers", () => {
    expect(messages(sell({ lookingFor: "", budgetBand: "" }))).toEqual({});
  });
});

describe("enquiryFormSchema, buying", () => {
  it("accepts a complete buyer's form", () => {
    expect(messages(buy())).toEqual({});
  });

  it("asks what they are looking for and their budget", () => {
    expect(messages(buy({ lookingFor: "", budgetBand: "" }))).toEqual({
      lookingFor: "Tell us what you are looking for",
      budgetBand: "Choose a budget",
    });
  });

  it("does not ask the buyer path for the work", () => {
    expect(messages(buy({ artist: "", departmentSlug: "" }))).toEqual({});
  });
});

describe("enquiryFormSchema, either path", () => {
  it("needs a name and a valid email address", () => {
    expect(messages(sell({ name: "", email: "daniel@" }))).toEqual({
      name: "Enter your name",
      email: "Enter an email address like name@example.com",
    });
  });

  it("needs a phone number to call when the sender prefers a call", () => {
    expect(messages(sell({ contactPreference: "phone", phone: "" })).phone).toBe(
      "Enter a phone number so we can call you",
    );
    expect(messages(buy({ contactPreference: "either", phone: "" })).phone).toBe(
      "Enter a phone number so we can call you",
    );
    expect(messages(sell({ contactPreference: "email", phone: "" }))).toEqual({});
  });

  it("checks a phone number when one is given", () => {
    expect(messages(sell({ phone: "abc" })).phone).toBe(
      "Enter a phone number, like 07700 900123 or +44 20 7946 0000",
    );
    expect(messages(sell({ phone: "07700 900123" }))).toEqual({});
  });

  it("has no required consent: the marketing box starts unticked and may stay so", () => {
    expect(emptyEnquiryValues("sell").marketingOptIn).toBe(false);
    expect(messages(sell({ marketingOptIn: false }))).toEqual({});
  });
});
