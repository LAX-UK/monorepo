import type { Database } from "@auction/db";
import type {
  IRegisterLotIntegrityReader,
  RegisterLotMismatch,
} from "../../interfaces/artwork-register-integrity.js";
import { findRegisterLotMismatches } from "./register-lot-mismatch.query.js";

export class DrizzleRegisterLotIntegrityReader implements IRegisterLotIntegrityReader {
  constructor(private readonly db: Database) {}

  listBidSaleMismatches(limit: number): Promise<RegisterLotMismatch[]> {
    return findRegisterLotMismatches(this.db, limit);
  }
}
