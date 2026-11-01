import type { CoverAnalysis, CoverAnalysisStatus } from "@auction/types";

export type CoverAnalysisRecord = {
  hash: string;
  status: CoverAnalysisStatus;
  analysis: CoverAnalysis | null;
};

export interface ICoverAnalysisReader {
  lookupByHashes(hashes: readonly string[]): Promise<Map<string, CoverAnalysisRecord>>;
}
