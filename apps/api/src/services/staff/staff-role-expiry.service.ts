import type {
  IStaffRoster,
  IStaffRosterTransaction,
  StaffRoleAssignmentRecord,
  StaffRosterEvent,
} from "@auction/persistence/interfaces";
import type { UserStaffRole } from "@auction/types";
import type { IPlatformStaffRolesCronApplicationService } from "../interfaces/platform-cron-routes/platform-staff-roles-cron.js";
import { profileRolesFor, staffAccessHistoryEvent } from "./staff-profile-roles.js";

/** One staff role whose end date passed and whose end was recorded by this run. */
export type EndedStaffRole = {
  readonly assignmentId: string;
  readonly userId: string;
  readonly role: UserStaffRole;
  readonly endedAt: Date;
};

/** Tells the person and the administrators that roles ended. Called after the ends are saved. */
export interface IStaffRoleExpiryNotifier {
  notifyEnded(ended: readonly EndedStaffRole[], now: Date): Promise<void>;
}

export type StaffRoleExpiryResult = { readonly expired: number; readonly people: number };

const DEFAULT_BATCH_SIZE = 200;

function groupByPerson(
  assignments: readonly StaffRoleAssignmentRecord[],
): Map<string, StaffRoleAssignmentRecord[]> {
  const byPerson = new Map<string, StaffRoleAssignmentRecord[]>();
  for (const assignment of assignments) {
    const group = byPerson.get(assignment.userId) ?? [];
    group.push(assignment);
    byPerson.set(assignment.userId, group);
  }
  return byPerson;
}

/**
 * Records the end of staff roles whose end date has passed. Permissions already ignore an ended
 * role; this writes the audit event, refreshes the role the profile shows, and tells the people
 * involved. Each end is recorded once: a run only picks up ends not yet recorded, under the
 * roster lock, and notifies only what it recorded.
 */
export class StaffRoleExpiryService implements IPlatformStaffRolesCronApplicationService {
  constructor(
    private readonly roster: IStaffRoster,
    private readonly notifier: IStaffRoleExpiryNotifier,
    private readonly clock: () => Date = () => new Date(),
    private readonly batchSize = DEFAULT_BATCH_SIZE,
  ) {}

  async expireEndedRoles(): Promise<StaffRoleExpiryResult> {
    const now = this.clock();
    const people = new Set<string>();
    let expired = 0;
    for (;;) {
      const ended = await this.roster.transact((tx) => this.recordBatch(tx, now));
      if (ended.length === 0) break;
      for (const e of ended) people.add(e.userId);
      expired += ended.length;
      await this.notifier.notifyEnded(ended, now);
      if (ended.length < this.batchSize) break;
    }
    return { expired, people: people.size };
  }

  /** Saves the ends, audit events and profile roles of one batch in the caller's transaction. */
  private async recordBatch(tx: IStaffRosterTransaction, now: Date): Promise<EndedStaffRole[]> {
    const batch = await tx.listUnrecordedEnds(now, this.batchSize);
    if (batch.length === 0) return [];

    const events: StaffRosterEvent[] = [];
    for (const [userId, assignments] of groupByPerson(batch)) {
      for (const a of assignments) {
        events.push({
          type: "staff.role_expired",
          userId,
          payload: {
            assignmentId: a.id,
            role: a.role,
            endedAt: (a.endsAt ?? now).toISOString(),
          },
        });
      }
      // Only staff hold assignments, so the platform role stays "staff".
      const next = profileRolesFor("staff", await tx.listCurrent(userId, now), now);
      const previous = await tx.writeProfileRoles(userId, next);
      const accessEvent = staffAccessHistoryEvent(previous, next, {
        userId,
        actorUserId: userId,
        invitationId: null,
      });
      if (accessEvent) events.push(accessEvent);
    }
    await tx.recordEnds(
      batch.map((a) => a.id),
      now,
    );
    await tx.recordEvents(events);

    return batch.map((a) => ({
      assignmentId: a.id,
      userId: a.userId,
      role: a.role,
      endedAt: a.endsAt ?? now,
    }));
  }
}
