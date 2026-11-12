import { checkOfferable } from "@auction/artwork-register-contracts";
import type {
  IArtworkRegisterReader,
  ILotRegisterLinkReader,
} from "@auction/persistence/interfaces";
import type { IReofferArtworkPlaceGuard } from "./reoffer-ports.js";

/**
 * Gallery sale wins (IC6/Q7). While a lot waits on a re-offer the register shows the artwork as
 * withdrawn, so the offer may go ahead only if the register still says the artwork may be offered
 * at this lot: if it was offered elsewhere, sold, or Zoho shows it sold or reserved, the offer is
 * refused with the lock's own message. A lot with no register record is not governed.
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
    const verdict = checkOfferable(entry, { kind: "bid_lot", id: lotId });
    return verdict.ok ? { ok: true } : { ok: false, message: verdict.error.lock.message };
  }
}
