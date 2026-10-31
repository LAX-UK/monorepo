import { needsYouTaskSplit } from "@auction/domain";
import type { ILegalEntityMembershipReader } from "@auction/persistence/interfaces";
import type {
  AccountNeedsYouCount,
  IAccountNeedsYouService,
  INeedsYouService,
} from "../interfaces/needs-you-service.js";

/** Accounts read at once, so a person in many organisations never floods the database. */
const CONCURRENCY = 4;
/** Far more organisations than anyone belongs to; past it the switcher shows no dot. */
const MAX_ACCOUNTS = 50;

export type AccountNeedsYouServiceDeps = {
  memberships: Pick<ILegalEntityMembershipReader, "listActiveMembershipsForUser">;
  needsYou: INeedsYouService;
};

/**
 * Reads Needs you once per organisation the person is an active member of, as their role in it,
 * through the same reader Home and the sidebar use, so a dot never disagrees with the account's
 * own Home. Tasks about the person (identity, source of funds) follow them into every account,
 * so they count on the person's own account instead of on each organisation; the most any
 * account reported is used, since a role can hide one of them. The membership list is the guard:
 * only the person's own active memberships are read. One account failing leaves that account
 * without a dot; the others still answer.
 */
export class AccountNeedsYouService implements IAccountNeedsYouService {
  constructor(private readonly deps: AccountNeedsYouServiceDeps) {}

  async countsFor(userId: string): Promise<AccountNeedsYouCount[]> {
    const memberships = await this.deps.memberships.listActiveMembershipsForUser(userId);
    const organisations = memberships
      .filter((m) => m.kind === "organisation" && !m.isImpersonation)
      .slice(0, MAX_ACCOUNTS);
    const counts: (AccountNeedsYouCount | null)[] = organisations.map(() => null);
    let personTasks = 0;
    let next = 0;
    const worker = async () => {
      while (next < organisations.length) {
        const index = next++;
        const membership = organisations[index];
        if (!membership) continue;
        try {
          const view = await this.deps.needsYou.read({
            userId,
            legalEntityId: membership.id,
            role: membership.role,
          });
          const split = needsYouTaskSplit(view.tasks);
          counts[index] = { legalEntityId: membership.id, count: split.account };
          personTasks = Math.max(personTasks, split.person);
        } catch {
          counts[index] = null;
        }
      }
    };
    const workers = Math.min(CONCURRENCY, organisations.length);
    await Promise.all(Array.from({ length: workers }, worker));
    const read = counts.filter((entry): entry is AccountNeedsYouCount => entry !== null);
    const personal = memberships.find((m) => m.kind === "individual" && !m.isImpersonation);
    return personal && read.length > 0
      ? [{ legalEntityId: personal.id, count: personTasks }, ...read]
      : read;
  }
}
