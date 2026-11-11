import { formatDate } from "@auction/datetime";
import { ISO_COUNTRY_CODES } from "@auction/shop-domain";

const regionNames = new Intl.DisplayNames(["en-GB"], { type: "region" });

/** The country as a buyer reads it ("Germany"), never just the code. */
export function countryName(code: string): string {
  return regionNames.of(code.toUpperCase()) ?? code;
}

/**
 * The countries checkout asks about, by name. The United Kingdom is left out (it has its own
 * choice), and countries the Shop does not deliver to stay on the list: choosing one explains why
 * and offers collection, which is kinder than a list that silently lacks the buyer's country.
 */
export function outsideUkCountryOptions(): { value: string; label: string }[] {
  return [
    { value: "", label: "Choose a country" },
    ...ISO_COUNTRY_CODES.filter((code) => code !== "GB")
      .map((code) => ({ value: code, label: countryName(code) }))
      .sort((a, b) => a.label.localeCompare(b.label, "en-GB")),
  ];
}

/** "12 November 2026", the one date style, from an ISO moment. */
export function holdUntilLabel(iso: string): string {
  return formatDate(new Date(iso), "Europe/London", { month: "long" });
}
