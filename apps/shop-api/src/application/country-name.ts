const regionNames = new Intl.DisplayNames(["en-GB"], { type: "region" });

/** The country as a person reads it ("Germany"), never just the code. */
export function countryNameOf(code: string): string {
  return regionNames.of(code) ?? code;
}
