/**
 * Production migration ceiling.
 *
 * A normal `pnpm db:migrate:prod` applies through 0159 only. Operators set
 * PRODUCTION_MIGRATION_THROUGH to promote 0160 (worker user-read revoke) and then
 * 0161 (API user-read revoke) on a live production, or to `head` to apply the whole
 * journal. The main-to-release cutover sets `head`: it runs in a maintenance window
 * with the old release binaries stopped, so the rolling 0160/0161 stages do not apply.
 * Local/CI `pnpm db:migrate` is unchanged.
 *
 * Every value keeps the runner's fail-closed history checks; 0160 and 0161 also
 * refuse to skip a stage. folderMillis values are the journal `when` stamps for
 * the staged tags; the contract test fails if the journal drifts.
 */
export const PRODUCTION_MIGRATION_THROUGH_ENV = "PRODUCTION_MIGRATION_THROUGH";

export const STAGED_PRODUCTION_MIGRATION_TAGS = ["0159", "0160", "0161"] as const;

export type StagedProductionMigrationTag = (typeof STAGED_PRODUCTION_MIGRATION_TAGS)[number];

/** Applies every journal migration. */
export const HEAD_PRODUCTION_MIGRATION_THROUGH = "head";

export const PRODUCTION_MIGRATION_THROUGH_TAGS = [
  ...STAGED_PRODUCTION_MIGRATION_TAGS,
  HEAD_PRODUCTION_MIGRATION_THROUGH,
] as const;

export type ProductionMigrationThroughTag = (typeof PRODUCTION_MIGRATION_THROUGH_TAGS)[number];

export const DEFAULT_PRODUCTION_MIGRATION_THROUGH = "0159" satisfies ProductionMigrationThroughTag;

export const PRODUCTION_MIGRATION_CEILING_BY_TAG: Record<
  StagedProductionMigrationTag,
  { folderMillis: number; requiresAppliedAtLeast: number | null }
> = {
  "0159": { folderMillis: 1788000035000, requiresAppliedAtLeast: null },
  "0160": { folderMillis: 1788000036000, requiresAppliedAtLeast: 1788000035000 },
  "0161": { folderMillis: 1788000037000, requiresAppliedAtLeast: 1788000036000 },
};

/** `folderMillis: null` means no ceiling: the runner applies the whole journal. */
export type ProductionMigrationCeiling = {
  tag: ProductionMigrationThroughTag;
  folderMillis: number | null;
};

function isProductionMigrationThroughTag(value: string): value is ProductionMigrationThroughTag {
  return (PRODUCTION_MIGRATION_THROUGH_TAGS as readonly string[]).includes(value);
}

function describeAppliedHead(lastAppliedFolderMillis: number | null): string {
  if (lastAppliedFolderMillis == null) return "none";
  for (const tag of STAGED_PRODUCTION_MIGRATION_TAGS) {
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
      `Invalid ${PRODUCTION_MIGRATION_THROUGH_ENV}=${JSON.stringify(raw)}. Allowed values: 0159 (default, directory only), 0160 (worker user-read revoke), 0161 (API user-read revoke), head (every migration; maintenance-window cutover only).`,
    );
  }
  if (value === HEAD_PRODUCTION_MIGRATION_THROUGH) return { tag: value, folderMillis: null };
  return { tag: value, folderMillis: PRODUCTION_MIGRATION_CEILING_BY_TAG[value].folderMillis };
}

export function assertStagedProductionMigrationPromotion(
  tag: ProductionMigrationThroughTag,
  lastAppliedFolderMillis: number | null,
): void {
  if (tag === HEAD_PRODUCTION_MIGRATION_THROUGH) return;
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
