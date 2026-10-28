import type { SellerIdentityFacts } from "@auction/domain";
import type {
  IKycSessionRepository,
  ILegalEntityRepository,
} from "@auction/persistence/interfaces";

/** What LAX has checked about a seller account's identity. */
export interface ISellerIdentityReader {
  factsFor(legalEntityId: string): Promise<SellerIdentityFacts | null>;
}

/**
 * A personal account is checked through its person's identity verification (the person who
 * holds the account); an organisation through LAX's review of its documents.
 */
export class SellerIdentityReader implements ISellerIdentityReader {
  constructor(
    private readonly legalEntities: Pick<ILegalEntityRepository, "findById">,
    private readonly kyc: Pick<IKycSessionRepository, "getUserKycState">,
  ) {}

  async factsFor(legalEntityId: string): Promise<SellerIdentityFacts | null> {
    const entity = await this.legalEntities.findById(legalEntityId);
    if (!entity) return null;
    if (entity.kind === "organisation") return { kind: "organisation", status: entity.status };
    const state = await this.kyc.getUserKycState(entity.createdByUserId);
    return { kind: "individual", kycStatus: state?.kycStatus ?? null };
  }
}
