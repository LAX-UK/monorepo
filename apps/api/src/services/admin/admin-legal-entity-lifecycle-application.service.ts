import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { LegalEntityStatus } from "@auction/types";
import type { Result } from "neverthrow";
import type { LifecycleAdminOp } from "../../lib/legal-entity-lifecycle-transitions.js";
import type { IAdminLegalEntityLifecycleApplicationService } from "../interfaces/admin-routes.js";
import type {
  LegalEntityLifecycleAdminService,
  LegalEntityLifecycleFailure,
} from "../legal-entity-lifecycle-admin.service.js";
import type { LegalEntityDocumentAdminService } from "./legal-entity-document-admin.service.js";

export class AdminLegalEntityLifecycleApplicationService
  implements IAdminLegalEntityLifecycleApplicationService
{
  constructor(
    private readonly legalEntities: ILegalEntityRepository,
    private readonly lifecycle: LegalEntityLifecycleAdminService,
    private readonly documents: LegalEntityDocumentAdminService,
  ) {}

  findLegalEntityById(id: string) {
    return this.legalEntities.findById(id);
  }

  runTransition(
    userId: string,
    entityId: string,
    op: LifecycleAdminOp,
    reason?: string | null,
  ): Promise<Result<{ id: string; status: LegalEntityStatus }, LegalEntityLifecycleFailure>> {
    return this.lifecycle.runTransition(userId, entityId, op, reason);
  }

  listDocuments(entityId: string) {
    return this.documents.listDocuments(entityId);
  }

  reviewDocument(...args: Parameters<LegalEntityDocumentAdminService["reviewDocument"]>) {
    return this.documents.reviewDocument(...args);
  }
}
