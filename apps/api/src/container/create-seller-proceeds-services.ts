import { LONDON_TIME_ZONE, dayKey } from "@auction/datetime";
import type { Database } from "@auction/db";
import type { IStaffLotSellerProceedsReader } from "@auction/persistence/interfaces";
import {
  DrizzleSaleSellerTermsStore,
  DrizzleSignedAgreementWriter,
  DrizzleStaffLotSellerProceedsReader,
  DrizzleUploadObjectReader,
} from "@auction/persistence/repositories";
import { RecordSignedAgreementService } from "../services/seller-proceeds/record-signed-agreement.service.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";

export type ContainerSellerProceedsServices = {
  reader: IStaffLotSellerProceedsReader;
  recordAgreement: RecordSignedAgreementService;
};

export function createSellerProceedsServices(input: {
  db: Database;
  platform: Pick<ContainerPlatformServices, "transactionRunner" | "domainEventSink">;
}): ContainerSellerProceedsServices {
  const { db, platform } = input;
  const reader = new DrizzleStaffLotSellerProceedsReader(db);
  return {
    reader,
    recordAgreement: new RecordSignedAgreementService({
      reader,
      uploads: new DrizzleUploadObjectReader(db),
      today: () => dayKey(new Date(), LONDON_TIME_ZONE),
      unitOfWork: (work) =>
        platform.transactionRunner.runInTransaction((tx) =>
          work({
            agreements: new DrizzleSignedAgreementWriter(tx),
            sellerTerms: new DrizzleSaleSellerTermsStore(tx as unknown as Database),
            events: platform.domainEventSink.withTx(tx),
          }),
        ),
    }),
  };
}
