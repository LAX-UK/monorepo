import type { ILaxAdminRoleExpiryRequests } from "@auction/persistence/interfaces";
import type {
  IPlatformStaffRolesCronApplicationService,
  StaffRoleExpiryResult,
} from "../interfaces/platform-cron-routes/platform-staff-roles-cron.js";
import type { IStaffRoleExpiryNotifier } from "./staff-role-expiry.service.js";

const DEFAULT_BATCH_SIZE = 200;

/**
 * Ends LAX Admin roles whose end date has passed. The roles already give nothing in LAX Admin;
 * this asks LAX Admin to record each end and tells the people involved, as Bid's own expiry does.
 * Each end is asked for once, so running again, or twice at once, sends nothing twice.
 */
export class LaxAdminRoleExpiryService implements IPlatformStaffRolesCronApplicationService {
  constructor(
    private readonly requests: ILaxAdminRoleExpiryRequests,
    private readonly notifier: IStaffRoleExpiryNotifier,
    private readonly clock: () => Date = () => new Date(),
    private readonly batchSize = DEFAULT_BATCH_SIZE,
  ) {}

  async expireEndedRoles(): Promise<StaffRoleExpiryResult> {
    const now = this.clock();
    const people = new Set<string>();
    let expired = 0;
    for (;;) {
      const ends = await this.requests.requestDueEnds(now, this.batchSize);
      if (ends.length === 0) break;
      for (const end of ends) people.add(end.subjectId);
      expired += ends.length;
      await this.notifier.notifyEnded(
        ends.map((end) => ({
          product: "shop" as const,
          assignmentId: end.assignmentId,
          userId: end.subjectId,
          role: end.role,
          endedAt: end.endedAt,
        })),
        now,
      );
      if (ends.length < this.batchSize) break;
    }
    return { expired, people: people.size };
  }
}

/** Runs each admin's expiry in turn as the one daily job, and adds up what they did. */
export class StaffRoleExpiryJob implements IPlatformStaffRolesCronApplicationService {
  constructor(private readonly admins: readonly IPlatformStaffRolesCronApplicationService[]) {}

  async expireEndedRoles(): Promise<StaffRoleExpiryResult> {
    let expired = 0;
    let people = 0;
    for (const admin of this.admins) {
      const result = await admin.expireEndedRoles();
      expired += result.expired;
      people += result.people;
    }
    return { expired, people };
  }
}
