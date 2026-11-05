import type {
  ArtworkRegisterEntry,
  MoveRefusal,
  ReopenListingAnswer,
  ReopenListingRequest,
} from "@auction/artwork-register-contracts";
import type { OriginalMoveReader } from "../ports/original-move.js";

export type ReopenOutcome =
  | { ok: true; data: ReopenListingAnswer }
  | { ok: false; status: 404 | 409; refusal: MoveRefusal };

/**
 * LAX Shop's half of "Return to lax.art". LAX Bid asks for the artwork's listing to come back as a
 * draft: an archived listing is restored, one that is already a draft is left as it is. Nothing
 * goes live here; staff publish it from LAX Admin, which is what records it as offered on lax.art.
 * Asking twice is safe.
 */
export class ReopenArtListingService {
  constructor(
    private readonly deps: {
      originals: OriginalMoveReader;
      register: { findById(id: string): Promise<ArtworkRegisterEntry | null> };
      /** Brings an archived listing back as a draft. */
      restoreListing: (input: { artworkId: string; actor: string }) => Promise<void>;
    },
  ) {}

  async reopen(request: ReopenListingRequest): Promise<ReopenOutcome> {
    const entry = await this.deps.register.findById(request.registerId);
    if (!entry) {
      return refuse(404, "register_not_found", "This artwork is not in the artwork register.");
    }
    const original = await this.deps.originals.findByZohoProductId(entry.zohoProductId);
    if (!original || original.runKind !== null) {
      return refuse(
        409,
        "no_listing",
        "There is no lax.art record for this artwork yet. Create it from the Zoho record in LAX Admin first.",
      );
    }
    if (!original.archived) {
      return { ok: true, data: { artworkId: original.artworkId, reopened: false } };
    }
    await this.deps.restoreListing({ artworkId: original.artworkId, actor: request.actor });
    return { ok: true, data: { artworkId: original.artworkId, reopened: true } };
  }
}

function refuse(status: 404 | 409, error: MoveRefusal["error"], message: string): ReopenOutcome {
  return { ok: false, status, refusal: { error, message } };
}
