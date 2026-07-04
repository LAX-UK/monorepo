import type { ILegalEntityRepository } from "@auction/persistence";
import type { LegalEntitySummary } from "@auction/types";
import type { IEnsurePersonalLegalEntityService } from "./ensure-personal-legal-entity.service.js";

/** Thrown when a user's personal legal entity cannot be found or provisioned. */
export class PersonalLegalEntityUnavailableError extends Error {
  constructor(userId: string) {
    super(`personal_entity_unavailable: user ${userId}`);
    this.name = "PersonalLegalEntityUnavailableError";
  }
}

export type PersonalLegalEntityUserReader = {
  getById(userId: string): Promise<{ email: string; name: string } | null>;
};

/** Resolves (and lazily provisions) the per-user personal legal entity for
 * client flows such as submissions and acting-context bootstrap.
 *
 * Fast path: existing row from {@link ILegalEntityRepository.ensurePersonalEntity}.
 * Slow path: idempotent create via {@link IEnsurePersonalLegalEntityService} when
 * the signup hook failed or raced.
 */
export interface IPersonalLegalEntityResolver {
  resolveForUser(userId: string): Promise<LegalEntitySummary>;
}

export class PersonalLegalEntityResolver implements IPersonalLegalEntityResolver {
  constructor(
    private readonly legalEntityRepository: ILegalEntityRepository,
    private readonly ensurePersonalLegalEntity: IEnsurePersonalLegalEntityService,
    private readonly users: PersonalLegalEntityUserReader,
  ) {}

  async resolveForUser(userId: string): Promise<LegalEntitySummary> {
    try {
      return await this.legalEntityRepository.ensurePersonalEntity(userId);
    } catch {
      const user = await this.users.getById(userId);
      if (!user) {
        throw new PersonalLegalEntityUnavailableError(userId);
      }
      await this.ensurePersonalLegalEntity.ensure({
        userId,
        displayName: user.name,
        email: user.email,
      });
      try {
        return await this.legalEntityRepository.ensurePersonalEntity(userId);
      } catch {
        throw new PersonalLegalEntityUnavailableError(userId);
      }
    }
  }
}
