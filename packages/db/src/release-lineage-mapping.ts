/** Approved release head and byte-identical SQL mapping from release migrations to main. */
export const APPROVED_RELEASE_HEAD = "bd1556dff97d290b3183f24347c040a0c60652a7";

/**
 * What ledger normalization does with a production row, keyed by SQL hash:
 * - `relabel`: main ships the same SQL under another tag and `when`; the row moves
 *   to main's `when` so main's own migration at the release stamp can apply.
 * - `keep`: main registers the SQL at the same `when`; the row stays as it is.
 * - `replace`: main supersedes the SQL with a later migration. The row is dropped
 *   because its `when` equals a different main migration (`shadowedMainTag`), which
 *   the "apply newer than the last row" rule would otherwise skip. The superseding
 *   migration re-runs harmlessly because its SQL is idempotent.
 */
export type ReleaseLedgerAction = "relabel" | "keep" | "replace";

export type ReleaseSqlMapping = {
  releaseTag: string;
  /** Journal `when` of the release row in the production ledger. */
  releaseWhen: number;
  mainTag: string;
  sha256: string;
  action: ReleaseLedgerAction;
  /** The main migration that owns `releaseWhen`; set only for `replace`. */
  shadowedMainTag?: string;
};

export const RELEASE_TO_MAIN_SQL_MAPPING: readonly ReleaseSqlMapping[] = [
  {
    releaseTag: "0128_marketing_attribution",
    releaseWhen: 1788000004000,
    mainTag: "0135_marketing_attribution",
    sha256: "c10eacdb728a9533167177da9302f9dc517e7c2d4428310529e1d14ed20f7147",
    action: "relabel",
  },
  {
    releaseTag: "0129_user_category_interests",
    releaseWhen: 1788000005000,
    mainTag: "0137_user_category_interests",
    sha256: "cbfb7f39eea0952a960393dd2aa18ce84e4d051a0eb552e2187966983aef7f41",
    action: "relabel",
  },
  {
    releaseTag: "0130_buyer_interest_categories",
    releaseWhen: 1788000006000,
    mainTag: "0138_buyer_interest_categories",
    sha256: "110ea13fa93d4f4d4ae37d855ed38023b0cebcf6c773ece10d9ebdd33a6b99bd",
    action: "relabel",
  },
  {
    releaseTag: "0131_complete_buyer_interest_categories",
    releaseWhen: 1788000007000,
    mainTag: "0139_complete_buyer_interest_categories",
    sha256: "4bc0f27d388a0619ae7d9a262902921983d108c6e516a71be8880f76aef89756",
    action: "relabel",
  },
  {
    releaseTag: "0132_atg_sync_links",
    releaseWhen: 1788000007500,
    mainTag: "0131a_atg_sync_links",
    sha256: "df070d5680416cb82bb064826d55fdcb386075b1fa9ea3f467c3d29bea72dc95",
    action: "keep",
  },
  {
    releaseTag: "0133_two_factor_lockout_columns",
    releaseWhen: 1788000008000,
    mainTag: "0222_two_factor_lockout_columns",
    sha256: "f33d8209b0549e0bee5de6806a5638881d7aabbd7a9198d85852a30415eee35c",
    action: "replace",
    shadowedMainTag: "0132_domain_event_delivery",
  },
];

export const MAIN_LINEAGE_ADOPTION_TARGET = "0139_complete_buyer_interest_categories";

export function assertApprovedReleaseHead(headSha: string): void {
  if (headSha !== APPROVED_RELEASE_HEAD) {
    throw new Error(`Unknown release head ${headSha}; lineage adoption is fail-closed`);
  }
}

export type ReleaseLedgerRow = { createdAt: number; hash: string };

export type LedgerNormalizationStep = {
  action: ReleaseLedgerAction;
  releaseTag: string;
  mainTag: string;
  /** Stamp of the production row before normalization. */
  fromWhen: number;
  /** Stamp the row holds afterwards; null when the row is dropped. */
  toWhen: number | null;
};

/**
 * Decide what happens to each release row in a production ledger. Fails closed when
 * a mapped row is missing or holds another hash, or when main's journal no longer
 * has the stamps the mapping assumes.
 */
export function planReleaseLedgerNormalization(
  ledger: readonly ReleaseLedgerRow[],
  mainWhenByTag: ReadonlyMap<string, number>,
): LedgerNormalizationStep[] {
  return RELEASE_TO_MAIN_SQL_MAPPING.map((mapping) => {
    const row = ledger.find((candidate) => candidate.createdAt === mapping.releaseWhen);
    if (!row) {
      throw new Error(`Ledger has no row at ${mapping.releaseWhen} for ${mapping.releaseTag}`);
    }
    if (row.hash !== mapping.sha256) {
      throw new Error(
        `Ledger row ${mapping.releaseWhen} does not hold the ${mapping.releaseTag} hash`,
      );
    }
    const mainWhen = mainWhenByTag.get(mapping.mainTag);
    if (mainWhen === undefined) {
      throw new Error(`Main journal has no ${mapping.mainTag}`);
    }
    const step = {
      action: mapping.action,
      releaseTag: mapping.releaseTag,
      mainTag: mapping.mainTag,
      fromWhen: mapping.releaseWhen,
    };
    if (mapping.action === "relabel") return { ...step, toWhen: mainWhen };
    if (mapping.action === "keep") {
      if (mainWhen !== mapping.releaseWhen) {
        throw new Error(`${mapping.mainTag} must be registered at ${mapping.releaseWhen}`);
      }
      return { ...step, toWhen: mainWhen };
    }
    const shadowedWhen = mapping.shadowedMainTag
      ? mainWhenByTag.get(mapping.shadowedMainTag)
      : undefined;
    if (shadowedWhen !== mapping.releaseWhen) {
      throw new Error(
        `${mapping.releaseTag} no longer shares its stamp with ${mapping.shadowedMainTag}; review the mapping`,
      );
    }
    return { ...step, toWhen: null };
  });
}
