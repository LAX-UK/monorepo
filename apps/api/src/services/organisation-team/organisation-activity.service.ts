import {
  type ActivityEntry,
  activityEntry,
  activityEventTypesFor,
  activityRetentionStart,
  entityActorCan,
} from "@auction/domain";
import type {
  ActivityListFilter,
  IOrganisationActivityReader,
} from "@auction/persistence/interfaces";
import type { OrganisationActivityQuery } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import type {
  ActivityEntryView,
  ActivityPage,
  IOrganisationActivityService,
  OrganisationTeamError,
} from "../interfaces/organisation-team-service.js";
import { activityCsv } from "./activity-csv.js";

const FORBIDDEN: OrganisationTeamError = {
  code: "forbidden",
  status: 403,
  message: "Only owners and admins can see the organisation's activity.",
};

/** The most rows one export holds; a year of a busy gallery's activity fits well inside. */
const EXPORT_MAX_ROWS = 5_000;
const EXPORT_PAGE = 500;

/** Who did something, when it was not a member: LAX staff or the system. */
const LAX = "LAX";

type Filters = Omit<OrganisationActivityQuery, "before" | "limit">;

/**
 * Activity for owners and admins: the domain table decides which events show and what of them,
 * the reader pages through the organisation's events, and people are named as members (or
 * "LAX" when staff or the system acted). History older than twelve months is never shown.
 */
export class OrganisationActivityService implements IOrganisationActivityService {
  private readonly now: () => Date;

  constructor(private readonly deps: { activity: IOrganisationActivityReader; now?: () => Date }) {
    this.now = deps.now ?? (() => new Date());
  }

  async list(
    actor: OrganisationMemberActor,
    query: OrganisationActivityQuery,
  ): Promise<Result<ActivityPage, OrganisationTeamError>> {
    if (!this.allowed(actor)) return err(FORBIDDEN);
    const records = await this.deps.activity.list({
      ...this.filter(actor, query),
      beforeId: query.before,
      limit: query.limit + 1,
    });
    const page = records.slice(0, query.limit);
    const entries = await this.named(actor, page);
    const last = page.at(-1);
    return ok({
      entries,
      nextBefore: records.length > query.limit && last ? last.id : null,
    });
  }

  async exportCsv(
    actor: OrganisationMemberActor,
    query: Filters,
  ): Promise<Result<{ csv: string; truncated: boolean }, OrganisationTeamError>> {
    if (!this.allowed(actor)) return err(FORBIDDEN);
    const filter = this.filter(actor, query);
    const all: ActivityEntryView[] = [];
    let beforeId: number | undefined;
    let truncated = false;
    for (;;) {
      const records = await this.deps.activity.list({ ...filter, beforeId, limit: EXPORT_PAGE });
      all.push(...(await this.named(actor, records)));
      const last = records.at(-1);
      if (records.length < EXPORT_PAGE || !last) break;
      if (all.length >= EXPORT_MAX_ROWS) {
        truncated = true;
        break;
      }
      beforeId = last.id;
    }
    return ok({ csv: activityCsv(all.slice(0, EXPORT_MAX_ROWS)), truncated });
  }

  private allowed(actor: OrganisationMemberActor): boolean {
    return entityActorCan({ role: actor.role }, "entity.activity.read");
  }

  private filter(
    actor: OrganisationMemberActor,
    query: Filters,
  ): Omit<ActivityListFilter, "beforeId" | "limit"> {
    const now = this.now();
    const oldest = activityRetentionStart(now);
    const from = query.from ? new Date(query.from) : oldest;
    return {
      legalEntityId: actor.legalEntityId,
      eventTypes: activityEventTypesFor(query.group ?? []),
      since: from > oldest ? from : oldest,
      until: query.to ? new Date(query.to) : new Date(now.getTime() + 1),
      personUserId: query.person,
    };
  }

  private async named(
    actor: OrganisationMemberActor,
    records: Parameters<typeof activityEntry>[0][],
  ): Promise<ActivityEntryView[]> {
    const entries = records
      .map(activityEntry)
      .filter((entry): entry is ActivityEntry => entry !== null);
    const ids = entries.flatMap((entry) =>
      [entry.actorUserId, entry.subjectUserId].filter((id): id is string => id !== null),
    );
    const people = await this.deps.activity.people(actor.legalEntityId, ids);
    return entries.map((entry) => {
      const by = entry.actorUserId ? people.get(entry.actorUserId) : undefined;
      const about = entry.subjectUserId ? people.get(entry.subjectUserId) : undefined;
      return {
        ...entry,
        // Staff acting for LAX are named as LAX, never by their own name.
        actorName: by?.wasMember ? by.name : LAX,
        subjectName: about?.name ?? null,
      };
    });
  }
}
