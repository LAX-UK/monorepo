import { SALE_AUTHORITY_NOTE_MAX_LENGTH } from "@auction/shop-contracts";
import type { EnumOption } from "@auction/staff-ui";

/*
 * Granting someone the right to sell editions of an artwork. The count is chosen from a closed
 * list rather than typed, the owner and artwork are chosen by name, and the note is the audit
 * trail, so all of it is checked before anything is sent.
 */

/** The most editions of one artwork a person can be authorised to sell. */
export const AUTHORISED_COUNT_MAX = 10;

export const AUTHORISED_COUNT_OPTIONS: EnumOption<string>[] = Array.from(
  { length: AUTHORISED_COUNT_MAX + 1 },
  (_, count) => ({
    value: String(count),
    label: count === 1 ? "1 edition" : `${count} editions`,
    ...(count === 0 ? { description: "Withdraws any authority they have" } : {}),
  }),
);

/** The button repeats what will happen: "Authorise 2 editions". */
export function grantButtonLabel(count: number | null): string {
  if (count === null) return "Grant authority";
  if (count === 0) return "Withdraw authority";
  return `Authorise ${count === 1 ? "1 edition" : `${count} editions`}`;
}

export type GrantAuthorityErrors = Partial<
  Record<"owner" | "artwork" | "count" | "evidenceNote", string>
>;

export type GrantAuthorityCheck =
  | {
      ok: true;
      body: {
        artworkId: string;
        ownerPartyId: string;
        authorisedCount: number;
        evidenceNote: string;
      };
    }
  | { ok: false; errors: GrantAuthorityErrors };

export function checkGrantAuthority(input: {
  owner: { id: string } | null;
  artwork: { id: string } | null;
  /** The chosen option's value, "0" to "10"; null until chosen. */
  count: string | null;
  evidenceNote: string;
}): GrantAuthorityCheck {
  const errors: GrantAuthorityErrors = {};
  if (!input.owner) errors.owner = "Choose who is being authorised.";
  if (!input.artwork) errors.artwork = "Choose the artwork they may sell.";
  const count = input.count === null ? Number.NaN : Number(input.count);
  if (!Number.isInteger(count) || count < 0 || count > AUTHORISED_COUNT_MAX) {
    errors.count = "Choose how many editions they may sell.";
  }
  const note = input.evidenceNote.trim();
  if (!note) {
    errors.evidenceNote = "Say what the authority is based on, such as a signed agreement.";
  } else if (note.length > SALE_AUTHORITY_NOTE_MAX_LENGTH) {
    errors.evidenceNote = `Use ${SALE_AUTHORITY_NOTE_MAX_LENGTH} characters or fewer.`;
  }
  if (Object.keys(errors).length > 0 || !input.owner || !input.artwork) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    body: {
      artworkId: input.artwork.id,
      ownerPartyId: input.owner.id,
      authorisedCount: count,
      evidenceNote: note,
    },
  };
}
