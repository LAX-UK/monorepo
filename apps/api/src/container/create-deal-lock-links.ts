import type { Database } from "@auction/db";
import { DrizzlePrivateSaleDealQueryRepository } from "@auction/persistence/repositories";
import type { Env } from "../env.js";
import { DealLockLinks } from "../services/private-sale-deal/deal-lock-links.js";

/** The links in the register's refusals, opened at the addresses this deployment is configured with. */
export function createDealLockLinks(input: { db: Database; env: Env }): DealLockLinks {
  return new DealLockLinks(
    {
      laxAdminOrigin: input.env.LAX_ADMIN_PUBLIC_ORIGIN,
      zohoRecordUrlTemplate: input.env.ZOHO_CRM_RECORD_URL_TEMPLATE,
    },
    new DrizzlePrivateSaleDealQueryRepository(input.db),
  );
}
