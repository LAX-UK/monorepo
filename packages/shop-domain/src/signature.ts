/** How a print is signed. Shared by the run's facts and by a print that is signed differently. */

export const SIGNATURE_MEDIA = ["pencil", "ink"] as const;
export type SignatureMedium = (typeof SIGNATURE_MEDIA)[number];

export const SIGNATURE_PLACES = ["front_lower_margin", "back"] as const;
export type SignaturePlace = (typeof SIGNATURE_PLACES)[number];

export type Signature =
  | { kind: "hand_signed"; medium: SignatureMedium; place: SignaturePlace }
  | { kind: "plate_signed" }
  | { kind: "estate_stamped" }
  | { kind: "estate_signed"; place: SignaturePlace }
  | { kind: "unsigned" };
