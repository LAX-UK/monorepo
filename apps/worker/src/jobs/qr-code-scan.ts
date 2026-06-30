import { persistQrCodeScan } from "@auction/db";
import type { Database } from "@auction/db";
import type { QrCodeScanJobPayload } from "@auction/queues";
import type pino from "pino";

export async function recordQrCodeScanJob({
  db,
  data,
  log,
}: {
  db: Database;
  data: QrCodeScanJobPayload;
  log: pino.Logger;
}): Promise<void> {
  const qrCodeId = data.qrCodeId?.trim();
  if (!qrCodeId) {
    throw new Error("qr-code-scan job is missing qrCodeId");
  }

  await persistQrCodeScan(db, { ...data, qrCodeId });
  log.debug({ qr_code_id: qrCodeId, request_id: data.requestId ?? undefined }, "qr scan recorded");
}
