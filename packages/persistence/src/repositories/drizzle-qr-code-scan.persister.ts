import { persistQrCodeScan } from "@auction/db";
import type { Database } from "@auction/db";
import type {
  IQrCodeScanPersister,
  QrCodeScanInput,
} from "../interfaces/qr-code-scan.persister.js";

export class DrizzleQrCodeScanPersister implements IQrCodeScanPersister {
  constructor(private readonly db: Database) {}

  persist(input: QrCodeScanInput): Promise<void> {
    return persistQrCodeScan(this.db, input);
  }
}
