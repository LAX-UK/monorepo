/**
 * The client workspace's key set: the same keys as LAX Admin and Bid admin where the job is the
 * same. The `g` keys come from this table and are offered only for pages in the person's menu,
 * which the nav model already shapes from their capabilities, so a key never leads to an access
 * page.
 */

export const CLIENT_HOTKEY_GROUPS = { anywhere: "Anywhere", lists: "In lists" } as const;

/** A `g` key per workspace page, by the menu entry's id. */
const GO_TO: readonly { page: string; keys: string; label: string }[] = [
  { page: "home", keys: "g h", label: "Home" },
  { page: "bids", keys: "g b", label: "Bids" },
  { page: "purchases", keys: "g p", label: "Purchases" },
  { page: "consignments", keys: "g c", label: "Consignments" },
  { page: "team", keys: "g t", label: "Team" },
];

export type ClientGoToShortcut = {
  id: string;
  keys: string;
  label: string;
  href: string;
  /** Position in the Anywhere group, after Search and Show shortcuts. */
  order: number;
};

/** The `g` keys for the pages this person can open, in the table's order. */
export function clientGoToShortcuts(
  pages: readonly { id: string; href: string }[],
): ClientGoToShortcut[] {
  const hrefs = new Map(pages.map((page) => [page.id, page.href]));
  return GO_TO.flatMap((entry, index) => {
    const href = hrefs.get(entry.page);
    return href
      ? [{ id: `go-${entry.page}`, keys: entry.keys, label: entry.label, href, order: 10 + index }]
      : [];
  });
}
