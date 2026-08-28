/**
 * Staged production migration ceiling for the Bid Identity directory cutover.
 *
 * A normal `pnpm db:migrate:prod` applies through 0159 only. Operators must set
 * PRODUCTION_MIGRATION_THROUGH to promote 0160 (worker user-read revoke) and
 * then 0161 (API user-read revoke). Local/CI `pnpm db:migrate` is unchanged.
 *
 * folderMillis values are the journal `when` stamps for those tags; the contract
 * test fails if the journal drifts.
 */
export const PRODUCTION_MIGRATION_THROUGH_ENV = "PRODUCTION_MIGRATION_THROUGH";

export const PRODUCTION_MIGRATION_THROUGH_TAGS = ["0159", "0160", "0161"] as const;

export type ProductionMigrationThroughTag = (typeof PRODUCTION_MIGRATION_THROUGH_TAGS)[number];

export const DEFAULT_PRODUCTION_MIGRATION_THROUGH = "0159" satisfies ProductionMigrationThroughTag;

export const PRODUCTION_MIGRATION_CEILING_BY_TAG: Record<
  ProductionMigrationThroughTag,
  { folderMillis: number; requiresAppliedAtLeast: number | null }
> = {
  "0159": { folderMillis: 1788000035000, requiresAppliedAtLeast: null },
  "0160": { folderMillis: 1788000036000, requiresAppliedAtLeast: 1788000035000 },
  "0161": { folderMillis: 1788000037000, requiresAppliedAtLeast: 1788000036000 },
};

export type ProductionMigrationCeiling = {
  tag: ProductionMigrationThroughTag;
  folderMillis: number;
};

function isProductionMigrationThroughTag(value: string): value is ProductionMigrationThroughTag {
  return (PRODUCTION_MIGRATION_THROUGH_TAGS as readonly string[]).includes(value);
}

function describeAppliedHead(lastAppliedFolderMillis: number | null): string {
  if (lastAppliedFolderMillis == null) return "none";
  for (const tag of PRODUCTION_MIGRATION_THROUGH_TAGS) {
    if (PRODUCTION_MIGRATION_CEILING_BY_TAG[tag].folderMillis === lastAppliedFolderMillis) {
      return tag;
    }
  }
  return String(lastAppliedFolderMillis);
}

export function resolveProductionMigrationCeiling(
  env: NodeJS.ProcessEnv = process.env,
): ProductionMigrationCeiling {
  const raw = env[PRODUCTION_MIGRATION_THROUGH_ENV];
  const value = raw === undefined ? DEFAULT_PRODUCTION_MIGRATION_THROUGH : raw.trim();
  if (!isProductionMigrationThroughTag(value)) {
    throw new Error(
      `Invalid ${PRODUCTION_MIGRATION_THROUGH_ENV}=${JSON.stringify(raw)}. Allowed values: 0159 (default, directory only), 0160 (worker user-read revoke), 0161 (API user-read revoke).`,
    );
  }
  return {
    tag: value,
    folderMillis: PRODUCTION_MIGRATION_CEILING_BY_TAG[value].folderMillis,
  };
}

export function assertStagedProductionMigrationPromotion(
  tag: ProductionMigrationThroughTag,
  lastAppliedFolderMillis: number | null,
): void {
  const required = PRODUCTION_MIGRATION_CEILING_BY_TAG[tag].requiresAppliedAtLeast;
  if (required == null) return;
  if (lastAppliedFolderMillis != null && lastAppliedFolderMillis >= required) return;

  const requiredTag =
    tag === "0160" ? DEFAULT_PRODUCTION_MIGRATION_THROUGH : tag === "0161" ? "0160" : tag;
  throw new Error(
    `Cannot promote production migrations through ${tag} until ${requiredTag} is already applied. Current head is ${describeAppliedHead(lastAppliedFolderMillis)}. Set ${PRODUCTION_MIGRATION_THROUGH_ENV}=${requiredTag} first.`,
  );
}

export function resolveProductionMigrationThrough(
  env: NodeJS.ProcessEnv,
  lastAppliedFolderMillis: number | null,
): ProductionMigrationCeiling {
  const ceiling = resolveProductionMigrationCeiling(env);
  assertStagedProductionMigrationPromotion(ceiling.tag, lastAppliedFolderMillis);
  return ceiling;
}
