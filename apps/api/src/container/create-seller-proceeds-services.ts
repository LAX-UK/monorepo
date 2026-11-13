import { LONDON_TIME_ZONE, dayKey } from "@auction/datetime";
import type { Database } from "@auction/db";
import type { ICommissionVatSettingReader } from "@auction/domain";
import type {
  IStaffLotSellerProceedsReader,
  IStaffPayoutSalesReader,
} from "@auction/persistence/interfaces";
import {
  DrizzleCommissionVatSettingReader,
  DrizzleSaleSellerTermsStore,
  DrizzleSignedAgreementWriter,
  DrizzleStaffLotSellerProceedsReader,
  DrizzleStaffPayoutSalesReader,
  DrizzleUploadObjectReader,
} from "@auction/persistence/repositories";
import { RecordSignedAgreementService } from "../services/seller-proceeds/record-signed-agreement.service.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";

export type ContainerSellerProceedsServices = {
  reader: IStaffLotSellerProceedsReader;
  payoutSales: IStaffPayoutSalesReader;
  vatSetting: ICommissionVatSettingReader;
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
    payoutSales: new DrizzleStaffPayoutSalesReader(db),
    vatSetting: new DrizzleCommissionVatSettingReader(db),
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
