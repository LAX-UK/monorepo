import type { Database } from "@auction/db";
import { saleNotDeleted, venueNotDeleted } from "@auction/db";
import { legalEntity, sale, venue } from "@auction/db/schema";
import type { CreateVenueInput, UpdateVenueInput, Venue } from "@auction/types";
import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import type {
  IVenueRepository,
  ListVenuesFilter,
  VenueListRow,
} from "../interfaces/venue.repository.js";

function toNumber(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function mapVenueRow(row: typeof venue.$inferSelect): Venue {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    name: row.name,
    slug: row.slug,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    county: row.county,
    postcode: row.postcode,
    country: row.country,
    mapUrl: row.mapUrl,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    openingHours: row.openingHours ?? null,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    website: row.website,
    photos: row.photos ?? [],
    capacity: row.capacity,
    accessNotes: row.accessNotes,
    parkingNotes: row.parkingNotes,
    directionsNotes: row.directionsNotes,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    deletedByUserId: row.deletedByUserId,
  };
}

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, "");
}

function buildListConditions(filter: ListVenuesFilter = {}) {
  const conditions = [venueNotDeleted()];
  if (!filter.includeArchived) {
    conditions.push(eq(venue.status, "active"));
  }
  if (filter.legalEntityId) {
    conditions.push(eq(venue.legalEntityId, filter.legalEntityId));
  }
  const q = filter.q?.trim();
  if (q) {
    const pattern = `%${escapeIlike(q)}%`;
    const search = or(
      ilike(venue.name, pattern),
      ilike(venue.city, pattern),
      ilike(venue.postcode, pattern),
    );
    if (search) conditions.push(search);
  }
  return conditions;
}

export class DrizzleVenueRepository implements IVenueRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Venue | null> {
    const [row] = await this.db
      .select()
      .from(venue)
      .where(and(eq(venue.id, id), venueNotDeleted()))
      .limit(1);
    return row ? mapVenueRow(row) : null;
  }

  async findBySlug(legalEntityId: string, slug: string): Promise<Venue | null> {
    const [row] = await this.db
      .select()
      .from(venue)
      .where(and(eq(venue.legalEntityId, legalEntityId), eq(venue.slug, slug), venueNotDeleted()))
      .limit(1);
    return row ? mapVenueRow(row) : null;
  }

  async list(filter: ListVenuesFilter = {}): Promise<VenueListRow[]> {
    const rows = await this.db
      .select({
        venue: venue,
        legalEntityDisplayName: legalEntity.displayName,
      })
      .from(venue)
      .leftJoin(legalEntity, eq(venue.legalEntityId, legalEntity.id))
      .where(and(...buildListConditions(filter)))
      .orderBy(asc(venue.name))
      .limit(filter.limit ?? 50)
      .offset(filter.offset ?? 0);
    return rows.map(({ venue: v, legalEntityDisplayName }) => ({
      ...mapVenueRow(v),
      legalEntityDisplayName: legalEntityDisplayName ?? null,
    }));
  }

  async count(filter: ListVenuesFilter = {}): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(venue)
      .where(and(...buildListConditions(filter)));
    return row?.value ?? 0;
  }

  async create(input: CreateVenueInput & { slug: string }): Promise<Venue> {
    const [row] = await this.db
      .insert(venue)
      .values({
        legalEntityId: input.legalEntityId,
        name: input.name,
        slug: input.slug,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2 ?? null,
        city: input.city,
        county: input.county ?? null,
        postcode: input.postcode,
        country: input.country,
        mapUrl: input.mapUrl ?? null,
        latitude: input.latitude == null ? null : String(input.latitude),
        longitude: input.longitude == null ? null : String(input.longitude),
        openingHours: input.openingHours ?? null,
        contactPhone: input.contactPhone ?? null,
        contactEmail: input.contactEmail ?? null,
        website: input.website ?? null,
        photos: input.photos ?? [],
        capacity: input.capacity ?? null,
        accessNotes: input.accessNotes ?? null,
        parkingNotes: input.parkingNotes ?? null,
        directionsNotes: input.directionsNotes ?? null,
      })
      .returning();
    if (!row) throw new Error("Venue create failed");
    return mapVenueRow(row);
  }

  async update(
    id: string,
    input: UpdateVenueInput & { slug?: string | undefined },
  ): Promise<Venue | null> {
    const [row] = await this.db
      .update(venue)
      .set({
        ...(input.legalEntityId !== undefined ? { legalEntityId: input.legalEntityId } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1 } : {}),
        ...(input.addressLine2 !== undefined ? { addressLine2: input.addressLine2 ?? null } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.county !== undefined ? { county: input.county ?? null } : {}),
        ...(input.postcode !== undefined ? { postcode: input.postcode } : {}),
        ...(input.country !== undefined ? { country: input.country } : {}),
        ...(input.mapUrl !== undefined ? { mapUrl: input.mapUrl ?? null } : {}),
        ...(input.latitude !== undefined
          ? { latitude: input.latitude == null ? null : String(input.latitude) }
          : {}),
        ...(input.longitude !== undefined
          ? { longitude: input.longitude == null ? null : String(input.longitude) }
          : {}),
        ...(input.openingHours !== undefined ? { openingHours: input.openingHours ?? null } : {}),
        ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone ?? null } : {}),
        ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail ?? null } : {}),
        ...(input.website !== undefined ? { website: input.website ?? null } : {}),
        ...(input.photos !== undefined ? { photos: input.photos } : {}),
        ...(input.capacity !== undefined ? { capacity: input.capacity ?? null } : {}),
        ...(input.accessNotes !== undefined ? { accessNotes: input.accessNotes ?? null } : {}),
        ...(input.parkingNotes !== undefined ? { parkingNotes: input.parkingNotes ?? null } : {}),
        ...(input.directionsNotes !== undefined
          ? { directionsNotes: input.directionsNotes ?? null }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(venue.id, id), venueNotDeleted()))
      .returning();
    return row ? mapVenueRow(row) : null;
  }

  async archive(id: string): Promise<Venue | null> {
    const [row] = await this.db
      .update(venue)
      .set({ status: "archived", updatedAt: new Date() })
      .where(and(eq(venue.id, id), venueNotDeleted()))
      .returning();
    return row ? mapVenueRow(row) : null;
  }

  async countSalesUsing(venueId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(sale)
      .where(and(eq(sale.venueId, venueId), saleNotDeleted()));
    return row?.value ?? 0;
  }
}
