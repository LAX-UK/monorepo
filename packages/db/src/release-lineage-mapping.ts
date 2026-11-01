/**
 * Production's migration ledger, as written by the approved `release` head, and what main does
 * with each release row when main is promoted.
 *
 * Release and main share migrations 0000–0127 byte for byte (same tag, `when` and hash). Above
 * that, release wrote eight rows whose stamps collide with, or sit between, main's own
 * migrations. Ledger normalisation (`release-lineage-normalisation.ts`) moves those eight rows
 * into `drizzle.__release_lineage_archive`, so the ledger ends at main 0127. The migration
 * runner then applies main from 0128 and, for each release row marked `adopt`, records main's
 * migration without running its SQL again (`release-lineage-adoption.ts`).
 */

/** The `release` commit production runs; normalisation refuses any other head. */
export const APPROVED_RELEASE_HEAD = "44be9ee834bed8430b9cd1cb701963a2fa9f679b";

/** Last migration release and main share. The normalised ledger ends here. */
export const RELEASE_LINEAGE_BASELINE = {
  tag: "0127_user_phone_number",
  when: 1788000003000,
} as const;

/**
 * - `adopt`: main ships byte-identical SQL as `mainTag` at `mainWhen`. Production already ran
 *   it, so the runner records main's row without executing it.
 * - `archive-only`: main has no equivalent. The row stays in the archive as a record; its
 *   effect is already in production data.
 */
export type ReleaseRowDisposition =
  | { kind: "adopt"; mainTag: string; mainWhen: number }
  | { kind: "archive-only"; reason: string };

export type ApprovedReleaseRow = {
  releaseTag: string;
  /** Journal `when` of the release migration: the row's `created_at` in production. */
  releaseWhen: number;
  /** SHA-256 of the release SQL file: the row's `hash` in production. */
  sha256: string;
  disposition: ReleaseRowDisposition;
};

export const APPROVED_RELEASE_ROWS: readonly ApprovedReleaseRow[] = [
  {
    releaseTag: "0128_marketing_attribution",
    releaseWhen: 1788000004000,
    sha256: "c10eacdb728a9533167177da9302f9dc517e7c2d4428310529e1d14ed20f7147",
    disposition: { kind: "adopt", mainTag: "0135_marketing_attribution", mainWhen: 1788000011000 },
  },
  {
    releaseTag: "0129_user_category_interests",
    releaseWhen: 1788000005000,
    sha256: "cbfb7f39eea0952a960393dd2aa18ce84e4d051a0eb552e2187966983aef7f41",
    disposition: {
      kind: "adopt",
      mainTag: "0137_user_category_interests",
      mainWhen: 1788000013000,
    },
  },
  {
    releaseTag: "0130_buyer_interest_categories",
    releaseWhen: 1788000006000,
    sha256: "110ea13fa93d4f4d4ae37d855ed38023b0cebcf6c773ece10d9ebdd33a6b99bd",
    disposition: {
      kind: "adopt",
      mainTag: "0138_buyer_interest_categories",
      mainWhen: 1788000014000,
    },
  },
  {
    releaseTag: "0131_complete_buyer_interest_categories",
    releaseWhen: 1788000007000,
    sha256: "4bc0f27d388a0619ae7d9a262902921983d108c6e516a71be8880f76aef89756",
    disposition: {
      kind: "adopt",
      mainTag: "0139_complete_buyer_interest_categories",
      mainWhen: 1788000015000,
    },
  },
  {
    releaseTag: "0132_atg_sync_links",
    releaseWhen: 1788000007500,
    sha256: "df070d5680416cb82bb064826d55fdcb386075b1fa9ea3f467c3d29bea72dc95",
    disposition: { kind: "adopt", mainTag: "0131a_atg_sync_links", mainWhen: 1788000007500 },
  },
  {
    releaseTag: "0133_two_factor_lockout_columns",
    releaseWhen: 1788000008000,
    sha256: "f33d8209b0549e0bee5de6806a5638881d7aabbd7a9198d85852a30415eee35c",
    disposition: {
      kind: "adopt",
      mainTag: "0222_two_factor_lockout_columns",
      mainWhen: 1794556800000,
    },
  },
  {
    releaseTag: "0134_atg_sale_settings",
    releaseWhen: 1795593600000,
    sha256: "b696fed93e0dba62e8f8c1f4ec69a2b55ac96e8fc34ebe58d1470a2df9e68488",
    disposition: { kind: "adopt", mainTag: "0234_atg_sale_settings", mainWhen: 1795593600000 },
  },
  {
    releaseTag: "0135_payment_refund_notify_skip_backlog",
    releaseWhen: 1795593660000,
    sha256: "c37a7db14400dd075422624c03a85621db8e9fc3fa2230b440c03d7211a00a38",
    disposition: {
      kind: "archive-only",
      reason:
        "Moved the refund notice projector past refunds recorded while it was stalled. Main reads the same projector_state row, so the effect carries over.",
    },
  },
];

export type ReleaseLineageAdoption = {
  releaseTag: string;
  releaseWhen: number;
  mainTag: string;
  mainWhen: number;
  sha256: string;
};

/**
 * The explicit allow-list of main migrations the runner may record without executing, and only
 * when the archive holds the release row with the same hash.
 */
export const RELEASE_LINEAGE_ADOPTIONS: readonly ReleaseLineageAdoption[] =
  APPROVED_RELEASE_ROWS.flatMap((row) =>
    row.disposition.kind === "adopt"
      ? [
          {
            releaseTag: row.releaseTag,
            releaseWhen: row.releaseWhen,
            mainTag: row.disposition.mainTag,
            mainWhen: row.disposition.mainWhen,
            sha256: row.sha256,
          },
        ]
      : [],
  );

export function assertApprovedReleaseHead(headSha: string): void {
  if (headSha !== APPROVED_RELEASE_HEAD) {
    throw new Error(
      `Release head ${headSha} is not the approved head ${APPROVED_RELEASE_HEAD}; normalisation is fail-closed. Review the release journal and update release-lineage-mapping.ts first.`,
    );
  }
}
