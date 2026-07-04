import type { ILegalEntityOnboardingRepository } from "@auction/persistence";
import type { OnboardingOrganisationRow } from "@auction/persistence";
import type { LegalEntity } from "@auction/types";
import type { CreateOrganizationInput, PublicOrganisationSubkind } from "@auction/validators";
import { PUBLIC_ORG_SUBKIND_META } from "@auction/validators";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type {
  CheckNameResult,
  CreateOrganizationResult,
  IOrganizationOnboardingService,
  OrgRequirements,
} from "./interfaces/organization-onboarding.js";

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

function rowToEntity(row: OnboardingOrganisationRow): LegalEntity {
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
    statusReason: row.statusReason ?? null,
    stripeConnectAccountId: row.stripeConnectAccountId ?? null,
    stripeCustomerId: row.stripeCustomerId ?? null,
    stripeConnectChargesEnabled: row.stripeConnectChargesEnabled,
    stripeConnectPayoutsEnabled: row.stripeConnectPayoutsEnabled,
    stripeConnectRequirementsCurrentlyDue: row.stripeConnectRequirementsCurrentlyDue ?? [],
    stripeConnectDisabledReason: row.stripeConnectDisabledReason ?? null,
    xeroContactId: row.xeroContactId ?? null,
    vatNumber: row.vatNumber ?? null,
    marginSchemeEligible: row.marginSchemeEligible,
    isLaxManaged: row.isLaxManaged,
    platformFeeBps: row.platformFeeBps ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Maximum non-archived organisations a single user may create. */
const MAX_ORGS_PER_USER = 3;

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

export class OrganizationOnboardingService implements IOrganizationOnboardingService {
  constructor(
    private readonly onboardingRepo: ILegalEntityOnboardingRepository,
    private readonly domainEventSink?: IDomainEventSink,
  ) {}

  async createOrganization(
    creatorUserId: string,
    input: CreateOrganizationInput,
  ): Promise<CreateOrganizationResult> {
    const count = await this.onboardingRepo.countNonArchivedOrganisationsByCreator(creatorUserId);
    if (count >= MAX_ORGS_PER_USER) {
      throw new Error("organization_limit_reached");
    }

    const baseSlug = slugify(input.displayName);
    let entity: OnboardingOrganisationRow | undefined;
    let slugAttempt = 1;

    while (!entity && slugAttempt <= 12) {
      let slug = baseSlug;
      if (slugAttempt > 1 && baseSlug.length > 0) {
        slug = `${baseSlug}-${slugAttempt}`;
      }
      try {
        entity = await this.onboardingRepo.transaction(async (tx) => {
          const created = await this.onboardingRepo.createOrganisationAttempt(
            {
              creatorUserId,
              displayName: input.displayName,
              legalName: input.legalName ?? null,
              subkind: input.subkind,
              vatNumber: input.vatNumber ?? null,
              slug,
              ...(input.primaryAddress !== undefined
                ? {
                    primaryAddress: {
                      ...input.primaryAddress,
                      line2: input.primaryAddress.line2 ?? null,
                      state: input.primaryAddress.state ?? null,
                      isDefault: input.primaryAddress.isDefault ?? null,
                    },
                  }
                : {}),
            },
            tx,
          );

          if (this.domainEventSink) {
            await this.domainEventSink.withTx(tx).publish({
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

          return created;
        });
      } catch (err) {
        if (err instanceof Error && err.message === "slug_taken") {
          slugAttempt += 1;
          continue;
        }
        if (isUniqueViolation(err)) {
          slugAttempt += 1;
          continue;
        }
        throw err;
      }
    }

    if (!entity) throw new Error("organization_create_failed");

    const requirements = this.getRequirements(input.subkind);
    const nextSteps: CreateOrganizationResult["nextSteps"] = ["kyc_individual", "kyb_documents"];
    if (requirements.requiresStripeConnect) nextSteps.push("stripe_connect");
    nextSteps.push("ready_to_consign");

    return { entity: rowToEntity(entity), nextSteps };
  }

  async checkNameAvailability(displayName: string): Promise<CheckNameResult> {
    const slug = slugify(displayName);
    if (!slug) return { available: false, suggestions: [] };

    const taken = await this.onboardingRepo.existsOrganisationSlug(slug);
    if (!taken) return { available: true, suggestions: [] };

    const takenSlugs = await this.onboardingRepo.listOrganisationSlugSuffixes(slug);
    const takenSet = new Set(takenSlugs);
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

  listSubkinds(): { value: PublicOrganisationSubkind; label: string; description: string }[] {
    return PUBLIC_ORG_SUBKIND_META.map(({ value, label, description }) => ({
      value,
      label,
      description,
    }));
  }
}
