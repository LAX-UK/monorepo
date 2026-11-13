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
import { createDrizzleCrmShopEnquiryReader } from "./crm-shop-enquiry-reader.js";
import { CrmSyncService, type CrmSyncServiceDeps } from "./crm-sync-service.js";

export function createCrmSyncService(input: {
  env: WorkerEnv;
  db: Database;
  linkRepo: ICrmRecordLinkRepository;
  gateway: CrmGateway;
  log?: { warn: (context: Record<string, unknown>, message: string) => void };
}): CrmSyncService {
  const log = input.log;
  const deps: CrmSyncServiceDeps = {
    gateway: input.gateway,
    linkRepo: input.linkRepo,
    env: input.env,
    paymentLotReader: createDrizzleCrmPaymentLotReader(input.db),
    attributionReader: createDrizzleCrmAttributionReader(input.db),
    enquiryReader: createDrizzleCrmEnquiryReader(input.db),
    dealNamingReader: createDrizzleCrmDealNamingReader(input.db),
    shopEnquiryReader: createDrizzleCrmShopEnquiryReader(input.db),
    ...(log
      ? {
          // Only the field's API name and Zoho's code: never the value that was refused.
          onPersonFieldDropped: (dropped) => log.warn(dropped, "zoho_crm_person_field_dropped"),
        }
      : {}),
    mapperContext: {
      leadStatusNew: input.env.ZOHO_CRM_LEAD_STATUS_NEW,
      ...(input.env.LAX_ART_PUBLIC_URL ? { artPublicUrl: input.env.LAX_ART_PUBLIC_URL } : {}),
      auctionPipeline: input.env.ZOHO_CRM_AUCTION_PIPELINE,
      dealStageLotWon: input.env.ZOHO_CRM_DEAL_STAGE_LOT_WON,
      dealStagePaymentCaptured: input.env.ZOHO_CRM_DEAL_STAGE_PAYMENT_CAPTURED,
      dealStagePaymentRefunded: input.env.ZOHO_CRM_DEAL_STAGE_PAYMENT_REFUNDED,
      dealStageShopPaid: input.env.ZOHO_CRM_DEAL_STAGE_SHOP_PAID,
    },
  };
  return new CrmSyncService(deps);
}
