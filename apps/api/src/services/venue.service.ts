import type { CreateVenueInput, UpdateVenueInput, Venue } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { VenueError } from "../lib/errors.js";
import { findPostgresError } from "../lib/pg-error.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type { IVenueRepository, ListVenuesFilter, VenueListRow } from "./interfaces/venue.js";

type VenueMutationContext = {
  actorUserId?: string | null;
};

export type ListVenuesResult = {
  venues: VenueListRow[];
  total: number;
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function mapVenueDbError(error: unknown): VenueError | null {
  const pg = findPostgresError(error);
  if (pg?.code === "23505" && pg.message.includes("venue_legal_entity_slug_uidx")) {
    return new VenueError("Could not generate a unique venue slug", 409, "venue_slug_conflict");
  }
  return null;
}

export class VenueService {
  constructor(
    private readonly venues: IVenueRepository,
    private readonly domainEventSink?: IDomainEventSink | null,
  ) {}

  async list(filter: ListVenuesFilter = {}): Promise<ListVenuesResult> {
    const [venues, total] = await Promise.all([
      this.venues.list(filter),
      this.venues.count(filter),
    ]);
    return { venues, total };
  }

  async get(id: string): Promise<Venue | null> {
    return this.venues.findById(id);
  }

  async getSalesUsingCount(id: string): Promise<number> {
    return this.venues.countSalesUsing(id);
  }

  async create(
    input: CreateVenueInput,
    ctx: VenueMutationContext = {},
  ): Promise<Result<Venue, VenueError>> {
    const slugResult = await this.uniqueSlug(input.legalEntityId, input.name);
    if (slugResult.isErr()) return err(slugResult.error);

    try {
      const created = await this.venues.create({ ...input, slug: slugResult.value });
      await this.publishEvent({
        aggregateId: created.id,
        eventType: "venue.created",
        payload: {
          legalEntityId: created.legalEntityId,
          name: created.name,
          slug: created.slug,
          status: created.status,
        },
        actorUserId: ctx.actorUserId ?? null,
      });
      return ok(created);
    } catch (error) {
      const mapped = mapVenueDbError(error);
      if (mapped) return err(mapped);
      throw error;
    }
  }

  async update(
    id: string,
    input: UpdateVenueInput,
    ctx: VenueMutationContext = {},
  ): Promise<Result<Venue, VenueError>> {
    const existing = await this.venues.findById(id);
    if (!existing) return err(new VenueError("Venue not found", 404, "venue_not_found"));

    if (input.legalEntityId !== undefined && input.legalEntityId !== existing.legalEntityId) {
      const referencingSales = await this.venues.countSalesUsing(id);
      if (referencingSales > 0) {
        return err(
          new VenueError(
            "Cannot change the legal entity while sales reference this venue",
            409,
            "venue_in_use",
          ),
        );
      }
    }

    const legalEntityId = input.legalEntityId ?? existing.legalEntityId;
    const patch: UpdateVenueInput & { slug?: string | undefined } = { ...input };
    if (
      (input.name !== undefined && input.name !== existing.name) ||
      (input.legalEntityId !== undefined && input.legalEntityId !== existing.legalEntityId)
    ) {
      const slugResult = await this.uniqueSlug(legalEntityId, input.name ?? existing.name, id);
      if (slugResult.isErr()) return err(slugResult.error);
      patch.slug = slugResult.value;
    }

    try {
      const updated = await this.venues.update(id, patch);
      if (!updated) return err(new VenueError("Venue not found", 404, "venue_not_found"));
      await this.publishEvent({
        aggregateId: id,
        eventType: "venue.updated",
        payload: {
          legalEntityId: updated.legalEntityId,
          name: updated.name,
          slug: updated.slug,
          status: updated.status,
          changedFields: Object.keys(input).sort(),
        },
        actorUserId: ctx.actorUserId ?? null,
      });
      return ok(updated);
    } catch (error) {
      const mapped = mapVenueDbError(error);
      if (mapped) return err(mapped);
      throw error;
    }
  }

  async archive(id: string, ctx: VenueMutationContext = {}): Promise<Result<Venue, VenueError>> {
    const existing = await this.venues.findById(id);
    if (!existing) return err(new VenueError("Venue not found", 404, "venue_not_found"));
    const referencingSales = await this.venues.countSalesUsing(id);
    if (referencingSales > 0) {
      return err(new VenueError("Cannot archive a venue used by sales", 409, "venue_in_use"));
    }
    const archived = await this.venues.archive(id);
    if (!archived) return err(new VenueError("Venue not found", 404, "venue_not_found"));
    await this.publishEvent({
      aggregateId: id,
      eventType: "venue.archived",
      payload: {
        legalEntityId: archived.legalEntityId,
        name: archived.name,
        slug: archived.slug,
        status: archived.status,
      },
      actorUserId: ctx.actorUserId ?? null,
    });
    return ok(archived);
  }

  private async uniqueSlug(
    legalEntityId: string,
    value: string,
    ignoreId?: string,
  ): Promise<Result<string, VenueError>> {
    const base = slugify(value);
    if (!base) {
      return err(new VenueError("Venue slug cannot be empty", 400, "venue_slug_empty"));
    }

    for (let index = 0; index < 100; index += 1) {
      const candidate = index === 0 ? base : `${base}-${index + 1}`;
      const existing = await this.venues.findBySlug(legalEntityId, candidate);
      if (!existing || existing.id === ignoreId) return ok(candidate);
    }

    return err(
      new VenueError("Could not generate a unique venue slug", 409, "venue_slug_conflict"),
    );
  }

  private async publishEvent(input: {
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
    actorUserId?: string | null;
  }): Promise<void> {
    if (!this.domainEventSink) return;
    await this.domainEventSink.publish({
      aggregateType: "venue",
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      payload: input.payload,
      actorUserId: input.actorUserId ?? null,
    });
  }
}
