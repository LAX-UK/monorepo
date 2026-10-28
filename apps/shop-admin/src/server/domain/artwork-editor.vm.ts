import type {
  AdminArtworkDetail,
  AdminArtworkState,
  AdminArtworkVisibilityAction,
} from "@auction/shop-contracts";
import { ARTWORK_PUBLISH_BLOCKER_MESSAGES } from "@auction/shop-domain";
import type { StatItem } from "@auction/staff-ui";

/*
 * How an artwork reads on its editor page and in the quick view: edition counts for staff, what
 * stops it going live, and which visibility actions apply. Pure, so tested without rendering.
 */

type EditionRun = AdminArtworkDetail["editions"];

/**
 * The run as staff need it: sold, committed to a checkout or a client, on sale, and not yet
 * authorised. Staff may see these counts; the storefront only ever says available or sold out.
 */
export function editionRunFacts(editions: EditionRun): StatItem[] {
  const { byStatus } = editions;
  return [
    { id: "sold", label: "Sold", value: byStatus.sold },
    {
      id: "committed",
      label: "Reserved or held",
      value: byStatus.reserved + byStatus.held,
      ...(byStatus.reserved > 0 ? { hint: `${byStatus.reserved} in a checkout` } : {}),
    },
    { id: "for-sale", label: "On sale", value: byStatus.authorised },
    {
      id: "not-authorised",
      label: "Not yet on sale",
      value: byStatus.not_authorised + byStatus.withdrawn,
      ...(byStatus.withdrawn > 0 ? { hint: `${byStatus.withdrawn} withdrawn` } : {}),
    },
  ];
}

export function publishBlockerMessages(
  detail: Pick<AdminArtworkDetail, "publishBlockers">,
): string[] {
  return detail.publishBlockers.map((blocker) => `${ARTWORK_PUBLISH_BLOCKER_MESSAGES[blocker]}.`);
}

/**
 * The editor's visibility actions for a state: the main one shown as a button, the rest in the
 * overflow menu. Publishing waits until nothing blocks it.
 */
export function artworkVisibilityActions(detail: {
  state: AdminArtworkState;
  publishBlockers: readonly string[];
}): { primary: AdminArtworkVisibilityAction | null; more: AdminArtworkVisibilityAction[] } {
  switch (detail.state) {
    case "draft":
      return {
        primary: detail.publishBlockers.length === 0 ? "publish" : null,
        more: ["archive"],
      };
    case "live":
    case "sold_out":
      return { primary: "unpublish", more: ["archive"] };
    case "archived":
      return { primary: "restore", more: [] };
  }
}

/** The editor's headline for what the change does, for the confirm and the toast. */
export const VISIBILITY_OUTCOME: Record<AdminArtworkVisibilityAction, string> = {
  publish: "It goes on the storefront now.",
  unpublish: "It leaves the storefront and becomes a draft. Baskets can no longer buy it.",
  archive:
    "It leaves the storefront and the default views. Editions, orders and sales stay on record; you can restore it later as a draft.",
  restore: "It comes back as a draft. Publish it again when it is ready.",
};

/** Capability names as the session lists them; the API checks the same ones. */
export function artworkPermissions(capabilities: readonly string[]): {
  write: boolean;
  setPrice: boolean;
  correctFacts: boolean;
  approveHorsCommerce: boolean;
} {
  return {
    write: capabilities.includes("catalogue.write"),
    setPrice: capabilities.includes("artwork_price.write"),
    correctFacts: capabilities.includes("edition_facts.correct"),
    approveHorsCommerce: capabilities.includes("hors_commerce.approve"),
  };
}
