import {
  ArtworkOfferedElsewhereError,
  checkOfferable,
  isReservedInZoho,
  isSoldInZoho,
} from "@auction/artwork-register-contracts";
import type {
  IArtworkRegisterReader,
  ILotRegisterLinkReader,
} from "@auction/persistence/interfaces";
import type { IReofferArtworkPlaceGuard } from "./reoffer-ports.js";

/**
 * Gallery sale wins (IC6/Q7). The offer may go ahead only if the register still says the artwork
 * may be offered at this lot: if it was offered elsewhere, or Zoho shows it Sold or Reserved, the
 * offer is refused with the lock's own message. The Zoho status is checked whatever the register's
 * offer state is, including while the entry still points at this lot (nothing moves the register
 * to withdrawn on a buyer default, so it can still read as offered here). A lot with no register
 * record is not governed.
 */
export class RegisterArtworkPlaceGuard implements IReofferArtworkPlaceGuard {
  constructor(
    private readonly links: Pick<ILotRegisterLinkReader, "findLink">,
    private readonly register: Pick<IArtworkRegisterReader, "findById">,
  ) {}

  async check(lotId: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const link = await this.links.findLink(lotId);
    if (!link) return { ok: true };
    const entry = await this.register.findById(link.registerId);
    if (!entry) return { ok: true };
    const ref = { kind: "bid_lot", id: lotId } as const;
    // An original already sold (or held back for another buyer) in Zoho cannot go to a new buyer.
    if (entry.kind === "original") {
      const reason = isSoldInZoho(entry.catalogueStatus)
        ? "sold_in_gallery"
        : isReservedInZoho(entry.catalogueStatus)
          ? "reserved_in_zoho"
          : null;
      if (reason) {
        const refused = new ArtworkOfferedElsewhereError(reason, entry.offer.state);
        return { ok: false, message: refused.lock.message };
      }
    }
    const verdict = checkOfferable(entry, ref);
    return verdict.ok ? { ok: true } : { ok: false, message: verdict.error.lock.message };
  }
}
