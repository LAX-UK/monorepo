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
import type { IObjectStorage } from "../services/interfaces/object-storage.js";
import { MarkSettledOutsideService } from "../services/seller-proceeds/mark-settled-outside.service.js";
import { RecordSignedAgreementService } from "../services/seller-proceeds/record-signed-agreement.service.js";
import { SignedAgreementDocumentService } from "../services/seller-proceeds/signed-agreement-document.service.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";

export type ContainerSellerProceedsServices = {
  reader: IStaffLotSellerProceedsReader;
  payoutSales: IStaffPayoutSalesReader;
  vatSetting: ICommissionVatSettingReader;
  recordAgreement: RecordSignedAgreementService;
  settledOutside: MarkSettledOutsideService;
  agreementDocument: SignedAgreementDocumentService;
};

export function createSellerProceedsServices(input: {
  db: Database;
  platform: Pick<ContainerPlatformServices, "transactionRunner" | "domainEventSink">;
  storage: Pick<IObjectStorage, "createPresignedGet">;
}): ContainerSellerProceedsServices {
  const { db, platform } = input;
  const reader = new DrizzleStaffLotSellerProceedsReader(db);
  const uploads = new DrizzleUploadObjectReader(db);
  return {
    agreementDocument: new SignedAgreementDocumentService({
      reader,
      uploads,
      storage: input.storage,
    }),
    reader,
    payoutSales: new DrizzleStaffPayoutSalesReader(db),
    vatSetting: new DrizzleCommissionVatSettingReader(db),
    settledOutside: new MarkSettledOutsideService({
      reader,
      unitOfWork: (work) =>
        platform.transactionRunner.runInTransaction((tx) =>
          work({
            facts: new DrizzleStaffLotSellerProceedsReader(tx as unknown as Database),
            locks: new DrizzleSignedAgreementWriter(tx),
            events: platform.domainEventSink.withTx(tx),
          }),
        ),
    }),
    recordAgreement: new RecordSignedAgreementService({
      reader,
      uploads,
      today: () => dayKey(new Date(), LONDON_TIME_ZONE),
      unitOfWork: (work) =>
        platform.transactionRunner.runInTransaction((tx) =>
          work({
            facts: new DrizzleStaffLotSellerProceedsReader(tx as unknown as Database),
            agreements: new DrizzleSignedAgreementWriter(tx),
            sellerTerms: new DrizzleSaleSellerTermsStore(tx as unknown as Database),
            events: platform.domainEventSink.withTx(tx),
          }),
        ),
    }),
  };
}
