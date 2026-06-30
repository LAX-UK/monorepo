import type { ArtistKind } from "@auction/types";

/** Inline-create artist payload accepted on submission approval. Mirrors
 * `inlineCreateArtistSchema` in `@auction/validators`. */
export type ApproveSubmissionNewArtist = {
  displayName: string;
  kind?: ArtistKind | undefined;
  shortBio?: string | undefined;
  ownerUserId?: string | null | undefined;
};

/** Body shape for `IItemSubmissionService.approve`. Either pick an existing
 * artist via {@link artistId} or create one inline via {@link newArtist}. Both
 * may be omitted to leave the lot unattributed (admin attaches later). */
export type ApproveSubmissionInput = {
  reviewNotes?: string | undefined;
  artistId?: string | null | undefined;
  newArtist?: ApproveSubmissionNewArtist | undefined;
};
