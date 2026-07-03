import type { Database } from "@auction/db";
import { DrizzleArtistRegistryRepository } from "../repositories/drizzle-artist-registry.repository.js";
import type { IArtistRegistryRepository } from "../repositories/interfaces/artist-registry.repository.js";
import { ArtistRegistryQueryService } from "./artist-registry/artist-registry-query.service.js";
import { ArtistRegistryStaffCommandService } from "./artist-registry/artist-registry-staff-command.service.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type {
  IArtistRegistryQueryService,
  IArtistRegistryService,
  IArtistRegistryStaffCommandService,
} from "./interfaces/artist-registry.js";

export {
  insertArtistInTx,
  replaceArtistCategoriesInTx,
  resolveUniqueArtistSlug,
} from "../repositories/artist-registry-mutations.js";

export type {
  IArtistRegistryQueryService,
  IArtistRegistryService,
  IArtistRegistryStaffCommandService,
};

/**
 * Artist registry migration facade. Delegates to segregated query (search /
 * browse / public read) and staff command (CRUD / merge / review) services
 * while preserving the original public surface for container wiring.
 */
export class ArtistRegistryService implements IArtistRegistryService {
  private readonly query: IArtistRegistryQueryService;
  private readonly staff: IArtistRegistryStaffCommandService;

  constructor(
    db: Database,
    domainEvents: DomainEventPublisher | null = null,
    repo?: IArtistRegistryRepository,
  ) {
    const registryRepo = repo ?? new DrizzleArtistRegistryRepository(db);
    this.query = new ArtistRegistryQueryService(registryRepo);
    this.staff = new ArtistRegistryStaffCommandService(
      registryRepo,
      this.query as ArtistRegistryQueryService,
      domainEvents,
    );
  }

  search(...args: Parameters<IArtistRegistryQueryService["search"]>) {
    return this.query.search(...args);
  }

  proposeMatches(...args: Parameters<IArtistRegistryQueryService["proposeMatches"]>) {
    return this.query.proposeMatches(...args);
  }

  findById(...args: Parameters<IArtistRegistryQueryService["findById"]>) {
    return this.query.findById(...args);
  }

  findBySlug(...args: Parameters<IArtistRegistryQueryService["findBySlug"]>) {
    return this.query.findBySlug(...args);
  }

  checkNameAvailability(...args: Parameters<IArtistRegistryQueryService["checkNameAvailability"]>) {
    return this.query.checkNameAvailability(...args);
  }

  create(...args: Parameters<IArtistRegistryStaffCommandService["create"]>) {
    return this.staff.create(...args);
  }

  resolveUniqueSlug(...args: Parameters<IArtistRegistryStaffCommandService["resolveUniqueSlug"]>) {
    return this.staff.resolveUniqueSlug(...args);
  }

  merge(...args: Parameters<IArtistRegistryStaffCommandService["merge"]>) {
    return this.staff.merge(...args);
  }

  mergeWithConfirmation(
    ...args: Parameters<IArtistRegistryStaffCommandService["mergeWithConfirmation"]>
  ) {
    return this.staff.mergeWithConfirmation(...args);
  }

  review(...args: Parameters<IArtistRegistryStaffCommandService["review"]>) {
    return this.staff.review(...args);
  }

  addAlias(...args: Parameters<IArtistRegistryStaffCommandService["addAlias"]>) {
    return this.staff.addAlias(...args);
  }

  proposeMatchesForAdmin(
    ...args: Parameters<IArtistRegistryStaffCommandService["proposeMatchesForAdmin"]>
  ) {
    return this.staff.proposeMatchesForAdmin(...args);
  }
}
