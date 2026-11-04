import { SELL_FORM_ERRORS, photoTooLargeMessage } from "@/lib/forms/submission/sell-form-copy";
import type { CatalogImageUploadKind } from "@/lib/upload/upload-policies.client";

export type UploadFailureCopy = {
  tooLarge: (maxBytes: number) => string;
  wrongType: string;
  /** What a failed upload says, given the cause the upload reported. */
  failed: (cause: string) => string;
};

const PHOTO_COPY: UploadFailureCopy = {
  tooLarge: photoTooLargeMessage,
  wrongType: SELL_FORM_ERRORS.photoType,
  failed: () => SELL_FORM_ERRORS.photoUploadFailed,
};

/** Every other upload keeps the words it has always had. */
const FILE_COPY: UploadFailureCopy = {
  tooLarge: (maxBytes) => `This file is over the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`,
  wrongType: "This file type is not supported.",
  failed: (cause) => cause,
};

/**
 * What a failed upload says on its row. A seller's photo of a work gets one sentence per cause,
 * each saying what to do; every other upload keeps its existing words.
 */
export function uploadFailureCopy(kind: CatalogImageUploadKind): UploadFailureCopy {
  return kind === "submission_image" ? PHOTO_COPY : FILE_COPY;
}
