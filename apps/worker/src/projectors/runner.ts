import type { IEmailService } from "@auction/email";
import type pino from "pino";
import type { IComplianceRecipientReader } from "../interfaces/compliance-recipient.reader.js";
import type { IStaffOpsRecipientReader } from "../interfaces/staff-ops-recipient.reader.js";
import { ProjectorStateRepository } from "./lib/projector-state.repository.js";
import type { Db, ProjectorRunContext } from "./lib/projector.types.js";
import { createDefaultProjectorRegistry } from "./projector-registry.js";

export function createProjectorRunner(options: {
  db: Db;
  log: pino.Logger;
  heartbeat: () => Promise<void>;
  staffOpsRecipientReader: IStaffOpsRecipientReader;
  complianceRecipientReader: IComplianceRecipientReader;
  /** when set, `payout.paid` events trigger Xero bill sync via API. */
  syncXeroPayoutBill?: (payoutId: string) => Promise<boolean>;
  /** when set, `lot.ended` (sold) triggers auto-invoice creation via API. */
  ensureLotInvoice?: (lotId: string) => Promise<void>;
  /** transactional email outbox for impersonation notices. */
  emailService?: IEmailService;
  /** when set, registration/verification events enqueue a marketing-contacts ESP sync. */
  enqueueMarketingContactSync?: (data: {
    userId: string;
    reason: string;
    eventId: number;
  }) => Promise<void>;
  supportContactEmail?: string;
  /** URL to admin payouts dashboard for failed transfer notifications. */
  adminPayoutsUrl?: string;
  /** Platform admin email address for ops notifications. */
  adminEmailAddress?: string;
  /** Web origin for admin lot URLs in ops emails. */
  webOrigin?: string;
}) {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  const stateRepo = new ProjectorStateRepository(options.db);
  const registry = createDefaultProjectorRegistry(stateRepo);

  async function tick() {
    const ctx: ProjectorRunContext = {
      db: options.db,
      log: options.log,
      emailService: options.emailService,
      supportContactEmail: options.supportContactEmail,
      adminPayoutsUrl: options.adminPayoutsUrl,
      adminEmailAddress: options.adminEmailAddress,
      webOrigin: options.webOrigin,
      staffOpsRecipientReader: options.staffOpsRecipientReader,
      complianceRecipientReader: options.complianceRecipientReader,
      syncXeroPayoutBill: options.syncXeroPayoutBill,
      ensureLotInvoice: options.ensureLotInvoice,
      enqueueMarketingContactSync: options.enqueueMarketingContactSync,
    };
    await registry.runAll(ctx);
    await options.heartbeat();
  }

  async function loop() {
    if (stopped) return;
    try {
      await tick();
    } catch (err) {
      options.log.error({ err }, "projector tick failed");
    }
    if (!stopped) timer = setTimeout(loop, 1500);
  }

  return {
    start() {
      void loop();
    },
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
