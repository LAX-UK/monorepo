import type { ArtworkRegisterEntry, LockMessage } from "@auction/artwork-register-contracts";
import type { IPrivateSaleDealQueryReader } from "@auction/persistence/interfaces";
import type { DealArtworkLock } from "@auction/validators";

/** The addresses a lock message's link can open, from configuration. A missing one leaves the link out. */
export type DealLockLinkConfig = {
  /** Where LAX Admin lives: its From Zoho record page says where an artwork is and links on from there. */
  laxAdminOrigin?: string | undefined;
  /** The CRM record page, with `{module}` and `{recordId}` in it. */
  zohoRecordUrlTemplate?: string | undefined;
};

type LinkedEntry = Pick<ArtworkRegisterEntry, "id" | "zohoProductId" | "offer">;

const trimSlash = (url: string): string => url.replace(/\/+$/, "");

/**
 * Turns the register's lock messages into ones with a link that opens. The words and the target
 * belong to the register's contract; where a target lives belongs to each product, so it is read
 * from configuration here and never written into the code.
 */
export class DealLockLinks {
  constructor(
    private readonly config: DealLockLinkConfig,
    private readonly deals: Pick<IPrivateSaleDealQueryReader, "findReferencesByIds">,
  ) {}

  /** Each lock with the address of its link, in the order given. */
  async attach(
    items: readonly { entry: LinkedEntry; lock: LockMessage }[],
  ): Promise<DealArtworkLock[]> {
    const dealIds = items.flatMap(({ entry, lock }) =>
      lock.link?.target === "private_sale" && entry.offer.ref?.kind === "private_sale"
        ? [entry.offer.ref.id]
        : [],
    );
    const references = await this.deals.findReferencesByIds([...new Set(dealIds)]);
    return items.map(({ entry, lock }) => ({
      ...lock,
      link: lock.link
        ? { ...lock.link, href: this.hrefFor(lock.link.target, entry, references) }
        : null,
    }));
  }

  private hrefFor(
    target: NonNullable<LockMessage["link"]>["target"],
    entry: LinkedEntry,
    references: ReadonlyMap<string, string>,
  ): string | null {
    const { laxAdminOrigin, zohoRecordUrlTemplate } = this.config;
    const ref = entry.offer.ref;
    switch (target) {
      case "bid_lot":
        // Bid admin is the product these screens are in, so its lot page is a path on the same host.
        return ref?.kind === "bid_lot" ? `/admin/lots/${encodeURIComponent(ref.id)}` : null;
      case "private_sale": {
        const reference = ref?.kind === "private_sale" ? references.get(ref.id) : undefined;
        return reference ? `/admin/private-sales/${encodeURIComponent(reference)}` : null;
      }
      case "lax_art_listing":
      case "sold_place":
      case "link_to_zoho":
        return laxAdminOrigin
          ? `${trimSlash(laxAdminOrigin)}/from-zoho/${encodeURIComponent(entry.id)}`
          : null;
      case "zoho_record":
        return zohoRecordUrlTemplate
          ? zohoRecordUrlTemplate
              .replace("{module}", "Products")
              .replace("{recordId}", encodeURIComponent(entry.zohoProductId))
          : null;
      case "open_sale":
        return null;
    }
  }

  /** The record page in LAX Admin for an artwork, when LAX Admin's address is configured. */
  recordHref(registerId: string): string | null {
    const origin = this.config.laxAdminOrigin;
    return origin ? `${trimSlash(origin)}/from-zoho/${encodeURIComponent(registerId)}` : null;
  }
}
