export type EditionListingStatus =
  | "not_authorised"
  | "authorised"
  | "reserved"
  | "held"
  | "sold"
  | "withdrawn";

export function canTransitionListingStatus(
  from: EditionListingStatus,
  to: EditionListingStatus,
): boolean {
  if (from === to) return true;
  const allowed: Record<EditionListingStatus, readonly EditionListingStatus[]> = {
    not_authorised: ["authorised", "withdrawn"],
    authorised: ["not_authorised", "reserved", "held", "sold"],
    reserved: ["authorised", "sold"],
    held: ["authorised", "sold"],
    sold: ["authorised"],
    withdrawn: ["not_authorised"],
  };
  return allowed[from].includes(to);
}
