import type { Database } from "@auction/db";
import type { SubjectExportFileSigner } from "./subject-export-file-signer.js";

/** What every Bid category reader needs. */
export type SubjectExportDeps = {
  db: Database;
  files: SubjectExportFileSigner;
  /** Public origin of the Bid web app, for links to sales and lots. */
  webOrigin: string;
};
