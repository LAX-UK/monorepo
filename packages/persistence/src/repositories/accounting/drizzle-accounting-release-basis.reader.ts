import type { Database } from "@auction/db";
import type { IAccountingReleaseBasisReader, ReleaseBasis } from "../../interfaces/accounting.js";
import { readReleaseBasis } from "../../lib/accounting-release-basis.js";

/** The rows a release is decided on, read before deciding (the move re-reads them under lock). */
export class DrizzleAccountingReleaseBasisReader implements IAccountingReleaseBasisReader {
  constructor(private readonly db: Database) {}

  read(basis: ReleaseBasis): Promise<string | null> {
    return readReleaseBasis(this.db, basis, false);
  }
}
