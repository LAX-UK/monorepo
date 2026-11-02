import type { Database } from "@auction/db";
import type { StorefrontOrigins } from "../../domain/storefront-origins.js";
import type { SubjectExportFileSigner } from "./subject-export-file-signer.js";

/** What every Shop category reader needs. */
export type SubjectExportDeps = {
  db: Database;
  files: SubjectExportFileSigner;
  /** Public origins of LAX Shop and lax.art, for links to works and artists. */
  origins: StorefrontOrigins;
};
