import { csvDocument } from "@/lib/workspace/csv";
import type { CollectionWork } from "./collection-works";

const DAY = (at: number) => (at > 0 ? new Date(at).toISOString().slice(0, 10) : "");

/**
 * The collection as CSV: title, reference, when it was acquired or returned, where it is, and,
 * for members who see money, what was paid for it (hammer and premium). The same rule as the
 * page decides the last column.
 */
export function collectionCsv(
  works: readonly CollectionWork[],
  options: { showPrice: boolean },
): string {
  const header = ["title", "reference", "acquired", "where_it_is"];
  if (options.showPrice) header.push("bought_for");
  return csvDocument(
    header,
    works.map((work) => {
      const row = [
        work.title,
        work.reference ?? "",
        work.kind === "bought" ? DAY(work.at) : "",
        work.where?.label ?? "",
      ];
      if (options.showPrice) row.push(work.boughtFor ?? "");
      return row;
    }),
  );
}
