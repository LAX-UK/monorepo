import { category, marketingAttribution, userCategoryInterest } from "@auction/db/schema";
import type { MarketingAttributionSnapshot } from "@auction/types";
import { and, asc, eq } from "drizzle-orm";
import {
  type ExportSource,
  SourcedExportCategory,
  inMemorySource,
} from "../sourced-export-category.js";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { isoRequired } from "../subject-export-values.js";
import { afterKey, countWhere } from "./keyset.js";

export function mapInterest(row: { id: string; name: string; createdAt: Date }) {
  return {
    id: row.id,
    origin: "provided" as const,
    kind: "interest",
    interest: row.name,
    changedAt: isoRequired(row.createdAt),
  };
}

type Touch = NonNullable<MarketingAttributionSnapshot["firstTouch"]>;

/**
 * Campaign attribution keeps the readable campaign fields. Advertising click identifiers (gclid,
 * fbclid and similar) are not part of the file.
 */
export function mapAttribution(which: "first" | "last", touch: Touch, subjectId: string) {
  return {
    id: `${subjectId}:${which}-touch`,
    origin: "observed" as const,
    kind: `attribution_${which}_touch`,
    campaign: touch.utmCampaign ?? null,
    source: touch.utmSource ?? null,
    medium: touch.utmMedium ?? null,
    landingPath: touch.landingPath,
    changedAt: touch.capturedAt,
  };
}

export class MarketingCategory extends SourcedExportCategory {
  readonly id = "marketing";
  protected readonly sources: readonly ExportSource[];

  constructor({ db }: SubjectExportDeps) {
    super();
    this.sources = [
      {
        count: (s) => countWhere(db, userCategoryInterest, eq(userCategoryInterest.userId, s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: category.id,
              name: category.name,
              createdAt: userCategoryInterest.createdAt,
            })
            .from(userCategoryInterest)
            .innerJoin(category, eq(category.id, userCategoryInterest.categoryId))
            .where(and(eq(userCategoryInterest.userId, s), afterKey(category.id, after)))
            .orderBy(asc(category.id))
            .limit(limit);
          return rows.map((row) => ({ key: row.id, record: mapInterest(row) }));
        },
      },
      inMemorySource(async (s) => {
        const [row] = await db
          .select({
            firstTouch: marketingAttribution.firstTouch,
            lastTouch: marketingAttribution.lastTouch,
          })
          .from(marketingAttribution)
          .where(eq(marketingAttribution.userId, s))
          .limit(1);
        const touches = [
          row?.firstTouch ? mapAttribution("first", row.firstTouch, s) : null,
          row?.lastTouch ? mapAttribution("last", row.lastTouch, s) : null,
        ];
        return touches.flatMap((record) => (record ? [{ key: record.id, record }] : []));
      }),
    ];
  }
}
