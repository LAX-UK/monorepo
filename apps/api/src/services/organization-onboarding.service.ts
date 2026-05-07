import type { Database } from "@auction/db";
import { legalEntity, legalEntityAddress, legalEntityMember } from "@auction/db/schema";
import type { LegalEntity } from "@auction/types";
import type { CreateOrganizationInput, PublicOrganisationSubkind } from "@auction/validators";
import { and, eq, sql } from "drizzle-orm";
import type {
  CheckNameResult,
  CreateOrganizationResult,
  IOrganizationOnboardingService,
  OrgRequirements,
} from "./interfaces/organization-onboarding.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";

const SUBKIND_LABELS: Record<PublicOrganisationSubkind, string> = {
  gallery: "Gallery",
  dealer: "Dealer",
  estate: "Estate",
  company: "Company",
  charity: "Charity",
  institution: "Institution",
  other: "Other",
};

const SUBKIND_REQUIREMENTS: Record<PublicOrganisationSubkind, OrgRequirements> = {
  gallery: {
    subkind: "gallery",
    documentKinds: ["companies_house_extract", "vat_certificate"],
    requiresStripeConnect: true,
    vatRequired: true,
  },
  dealer: {
    subkind: "dealer",
    documentKinds: ["companies_house_extract", "vat_certificate"],
    requiresStripeConnect: true,
    vatRequired: true,
  },
  estate: {
    subkind: "estate",
    documentKinds: ["beneficial_owner_id", "provenance_sample"],
    requiresStripeConnect: true,
    vatRequired: false,
  },
  company: {
    subkind: "company",
    documentKinds: ["companies_house_extract", "vat_certificate"],
    requiresStripeConnect: true,
    vatRequired: true,
  },
  charity: {
    subkind: "charity",
    documentKinds: ["companies_house_extract"],
    requiresStripeConnect: true,
    vatRequired: false,
  },
  institution: {
    subkind: "institution",
    documentKinds: ["companies_house_extract"],
    requiresStripeConnect: true,
    vatRequired: false,
  },
  other: {
    subkind: "other",
    documentKinds: ["beneficial_owner_id"],
    requiresStripeConnect: true,
    vatRequired: false,
  },
};

/** Generates a URL-safe slug. Lowercase, alphanumeric and hyphens, ≤80 chars.
 * The DB has a unique partial index on `legal_entity.slug` so we suffix
 * collisions with `-2`, `-3`, ... while inserting.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function rowToEntity(row: typeof legalEntity.$inferSelect): LegalEntity {
  return {
    id: row.id,
    displayName: row.displayName,
    legalName: row.legalName ?? null,
    slug: row.slug ?? null,
    kind: row.kind,
    subkind: row.subkind,
    createdByUserId: row.createdByUserId,
    status: row.status,
    statusChangedAt: row.statusChangedAt ?? null,
    statusChangedByUserId: row.statusChangedByUserId ?? null,
    stripeConnectAccountId: row.stripeConnectAccountId ?? null,
    stripeConnectChargesEnabled: row.stripeConnectChargesEnabled,
    stripeConnectPayoutsEnabled: row.stripeConnectPayoutsEnabled,
    stripeConnectRequirementsCurrentlyDue: row.stripeConnectRequirementsCurrentlyDue ?? [],
    xeroContactId: row.xeroContactId ?? null,
    vatNumber: row.vatNumber ?? null,
    marginSchemeEligible: row.marginSchemeEligible,
    isLaxManaged: row.isLaxManaged,
    platformFeeBps: row.platformFeeBps ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class OrganizationOnboardingService implements IOrganizationOnboardingService {
  constructor(
    private readonly db: Database,
    private readonly domainEventPublisher?: DomainEventPublisher,
  ) {}

  async createOrganization(
    creatorUserId: string,
    input: CreateOrganizationInput,
  ): Promise<CreateOrganizationResult> {
    const baseSlug = slugify(input.displayName);

    const entity = await this.db.transaction(async (tx) => {
      let slug = baseSlug;
      let attempt = 1;
      while (slug.length > 0) {
        const existing = await tx
          .select({ id: legalEntity.id })
          .from(legalEntity)
          .where(eq(legalEntity.slug, slug))
          .limit(1);
        if (existing.length === 0) break;
        attempt += 1;
        slug = `${baseSlug}-${attempt}`;
      }

      const [created] = await tx
        .insert(legalEntity)
        .values({
          displayName: input.displayName,
          legalName: input.legalName ?? null,
          slug: slug.length > 0 ? slug : null,
          kind: "organisation",
          subkind: input.subkind,
          createdByUserId: creatorUserId,
          status: "lead",
          vatNumber: input.vatNumber ?? null,
        })
        .returning();
      if (!created) throw new Error("organization_create_failed");

      await tx.insert(legalEntityMember).values({
        legalEntityId: created.id,
        userId: creatorUserId,
        role: "owner",
        isPrimaryAdmin: true,
        invitedByUserId: creatorUserId,
        invitedAt: new Date(),
        acceptedAt: new Date(),
      });

      if (this.domainEventPublisher) {
        await this.domainEventPublisher.publish(tx, {
          aggregateType: "legal_entity",
          aggregateId: created.id as string,
          eventType: "legal_entity.created",
          payload: {
            kind: "organisation",
            subkind: input.subkind,
            display_name: input.displayName,
            initial_status: "lead",
          },
          actorUserId: creatorUserId,
          actingLegalEntityId: created.id as string,
        });
      }

      if (input.primaryAddress) {
        await tx.insert(legalEntityAddress).values({
          legalEntityId: created.id,
          addressType: input.primaryAddress.addressType,
          line1: input.primaryAddress.line1,
          line2: input.primaryAddress.line2 ?? null,
          city: input.primaryAddress.city,
          state: input.primaryAddress.state ?? null,
          postalCode: input.primaryAddress.postalCode,
          country: input.primaryAddress.country,
          isDefault: input.primaryAddress.isDefault ?? true,
        });
      }

      return created;
    });

    const requirements = this.getRequirements(input.subkind);
    const nextSteps: CreateOrganizationResult["nextSteps"] = ["kyc_individual", "kyb_documents"];
    if (requirements.requiresStripeConnect) nextSteps.push("stripe_connect");
    nextSteps.push("ready_to_consign");

    return { entity: rowToEntity(entity), nextSteps };
  }

  async checkNameAvailability(displayName: string): Promise<CheckNameResult> {
    const slug = slugify(displayName);
    if (!slug) return { available: false, suggestions: [] };

    const exists = await this.db
      .select({ id: legalEntity.id })
      .from(legalEntity)
      .where(and(eq(legalEntity.slug, slug), eq(legalEntity.kind, "organisation")))
      .limit(1);

    if (exists.length === 0) return { available: true, suggestions: [] };

    // Suggest first three numeric suffixes that aren't taken.
    const taken = await this.db
      .select({ slug: legalEntity.slug })
      .from(legalEntity)
      .where(sql`${legalEntity.slug} like ${`${slug}-%`}`);
    const takenSet = new Set(taken.map((r) => r.slug).filter(Boolean) as string[]);
    const suggestions: string[] = [];
    for (let n = 2; suggestions.length < 3 && n < 12; n += 1) {
      const candidate = `${slug}-${n}`;
      if (!takenSet.has(candidate)) suggestions.push(candidate);
    }
    return { available: false, suggestions };
  }

  getRequirements(subkind: PublicOrganisationSubkind): OrgRequirements {
    return SUBKIND_REQUIREMENTS[subkind];
  }

  listSubkinds(): { value: PublicOrganisationSubkind; label: string }[] {
    return (Object.keys(SUBKIND_LABELS) as PublicOrganisationSubkind[]).map((value) => ({
      value,
      label: SUBKIND_LABELS[value],
    }));
  }
}
