import type { Database } from "@auction/db";
import type { ICrmRecordLinkRepository } from "@auction/persistence/interfaces";
import type { WorkerEnv } from "../../env.js";
import { createDrizzleCrmDealNamingReader } from "./crm-deal-naming-reader.js";
import type { CrmGateway } from "./crm-gateway.js";
import {
  createDrizzleCrmAttributionReader,
  createDrizzleCrmEnquiryReader,
  createDrizzleCrmPaymentLotReader,
} from "./crm-readers.js";
import { CrmSyncService, type CrmSyncServiceDeps } from "./crm-sync-service.js";

export function createCrmSyncService(input: {
  env: WorkerEnv;
  db: Database;
  linkRepo: ICrmRecordLinkRepository;
  gateway: CrmGateway;
}): CrmSyncService {
  const deps: CrmSyncServiceDeps = {
    gateway: input.gateway,
    linkRepo: input.linkRepo,
    env: input.env,
    paymentLotReader: createDrizzleCrmPaymentLotReader(input.db),
    attributionReader: createDrizzleCrmAttributionReader(input.db),
    enquiryReader: createDrizzleCrmEnquiryReader(input.db),
    dealNamingReader: createDrizzleCrmDealNamingReader(input.db),
    mapperContext: {
      leadStatusNew: input.env.ZOHO_CRM_LEAD_STATUS_NEW,
      auctionPipeline: input.env.ZOHO_CRM_AUCTION_PIPELINE,
      dealStageLotWon: input.env.ZOHO_CRM_DEAL_STAGE_LOT_WON,
      dealStagePaymentCaptured: input.env.ZOHO_CRM_DEAL_STAGE_PAYMENT_CAPTURED,
      dealStagePaymentRefunded: input.env.ZOHO_CRM_DEAL_STAGE_PAYMENT_REFUNDED,
      dealStageShopPaid: input.env.ZOHO_CRM_DEAL_STAGE_SHOP_PAID,
      dealStageShopEnquiry: input.env.ZOHO_CRM_DEAL_STAGE_SHOP_ENQUIRY,
    },
  };
  return new CrmSyncService(deps);
}
