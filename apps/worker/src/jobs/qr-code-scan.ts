import type { IQrCodeScanPersister } from "@auction/persistence/interfaces";
import type { QrCodeScanJobPayload } from "@auction/queues";
import type pino from "pino";

export async function recordQrCodeScanJob({
  qrCodeScanPersister,
  data,
  log,
}: {
  qrCodeScanPersister: IQrCodeScanPersister;
  data: QrCodeScanJobPayload;
  log: pino.Logger;
}): Promise<void> {
  const qrCodeId = data.qrCodeId?.trim();
  if (!qrCodeId) {
    throw new Error("qr-code-scan job is missing qrCodeId");
  }

  await qrCodeScanPersister.persist({ ...data, qrCodeId });
  log.debug({ qr_code_id: qrCodeId, request_id: data.requestId ?? undefined }, "qr scan recorded");
}
