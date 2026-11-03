/**
 * The words the sell form uses when something is missing or wrong. One message per problem, the
 * same sentence in the summary at the top of a step and under the field.
 */
export const SELL_FORM_ERRORS = {
  title: "Enter the title of the work",
  category: "Choose a category",
  photo: "Add at least one photo",
  price: "Enter a price in pounds, like 2,500",
  /** A photo that did not upload for any reason other than its size or type. */
  photoUploadFailed: "This photo didn't upload. Try again",
  /** A file that is not an image the form accepts. */
  photoType: "This file isn't a photo we can use. Choose a JPG, PNG or WebP",
} as const;

/** "This photo is over 10 MB. Choose a smaller file", with the limit the upload policy sets. */
export function photoTooLargeMessage(maxBytes: number): string {
  return `This photo is over ${Math.round(maxBytes / 1024 / 1024)} MB. Choose a smaller file`;
}

/** The title of the summary shown at the top of a step with problems. */
export const SELL_FORM_SUMMARY_TITLE = "Check these before you continue";
