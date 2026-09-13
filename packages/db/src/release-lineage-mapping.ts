/** Approved release head and byte-identical SQL renumber mapping to main. */
export const APPROVED_RELEASE_HEAD = "b385dfb06f6d7324f310e1c8180cd9ffb49ca3d9";

export const RELEASE_TO_MAIN_SQL_MAPPING = [
  {
    releaseTag: "0128_marketing_attribution",
    mainTag: "0135_marketing_attribution",
    sha256: "c10eacdb728a9533167177da9302f9dc517e7c2d4428310529e1d14ed20f7147",
  },
  {
    releaseTag: "0129_user_category_interests",
    mainTag: "0137_user_category_interests",
    sha256: "cbfb7f39eea0952a960393dd2aa18ce84e4d051a0eb552e2187966983aef7f41",
  },
  {
    releaseTag: "0130_buyer_interest_categories",
    mainTag: "0138_buyer_interest_categories",
    sha256: "110ea13fa93d4f4d4ae37d855ed38023b0cebcf6c773ece10d9ebdd33a6b99bd",
  },
  {
    releaseTag: "0131_complete_buyer_interest_categories",
    mainTag: "0139_complete_buyer_interest_categories",
    sha256: "4bc0f27d388a0619ae7d9a262902921983d108c6e516a71be8880f76aef89756",
  },
] as const;

export const MAIN_LINEAGE_ADOPTION_TARGET = "0139_complete_buyer_interest_categories";

export function assertApprovedReleaseHead(headSha: string): void {
  if (headSha !== APPROVED_RELEASE_HEAD) {
    throw new Error(`Unknown release head ${headSha}; lineage adoption is fail-closed`);
  }
}
