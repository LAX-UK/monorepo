import type { PublicOrganisationSubkind } from "@auction/validators";
import { evaluateConnectStepReadiness } from "./onboarding-connect-gate.js";
import type { IOnboardingStepService, OnboardingStepCompleteResult } from "./onboarding-context.js";
import type { OnboardingContext } from "./onboarding-context.js";
import { assertDocumentsComplete } from "./org-onboarding-documents.js";
import type { OrganizationOnboardingFlowDeps } from "./org-onboarding-types.js";

export class OnboardingStepService implements IOnboardingStepService {
  constructor(private readonly ctx: OnboardingContext) {}

  async completeStep(
    userId: string,
    entityId: string,
    step: Parameters<IOnboardingStepService["completeStep"]>[2],
  ): Promise<OnboardingStepCompleteResult> {
    const membership = await this.ctx.legalEntityRepository.findActiveMembership(userId, entityId);
    if (!membership) return { ok: false, code: "forbidden" };
    if (membership.role !== "owner" && membership.role !== "admin") {
      return { ok: false, code: "forbidden" };
    }

    const row = await this.ctx.onboardingRepo.findOrganisationById(entityId);
    if (!row || row.kind !== "organisation") return { ok: false, code: "not_found" };

    const subkind = row.subkind as PublicOrganisationSubkind;

    if (step === "type") {
      if (!row.subkind) return { ok: false, code: "type_incomplete" };
    }

    if (step === "details") {
      if (!row.displayName?.trim()) return { ok: false, code: "address_required" };
      const addrOk = await this.ctx.onboardingRepo.hasRegisteredOfficeAddress(entityId);
      if (!addrOk) return { ok: false, code: "address_required" };
      const reqs = this.ctx.organizationOnboardingService.getRequirements(subkind);
      if (reqs.vatRequired && !row.vatNumber?.trim()) {
        return { ok: false, code: "vat_required" };
      }
    }

    if (step === "documents") {
      const okDocs = await assertDocumentsComplete(this.documentDeps(), entityId, subkind);
      if (!okDocs) return { ok: false, code: "documents_incomplete" };
    }

    if (step === "connect") {
      const connectResult = await this.validateConnectStep(entityId);
      if (!connectResult.ok) return connectResult;
    }

    await this.ctx.onboardingRepo.markStepComplete(entityId, step);
    return { ok: true };
  }

  async completeDetailsWithType(
    userId: string,
    entityId: string,
  ): Promise<OnboardingStepCompleteResult> {
    const typeResult = await this.completeStep(userId, entityId, "type");
    if (!typeResult.ok) return typeResult;
    return this.completeStep(userId, entityId, "details");
  }

  private documentDeps(): OrganizationOnboardingFlowDeps {
    return {
      legalEntityRepository: this.ctx.legalEntityRepository,
      onboardingRepo: this.ctx.onboardingRepo,
      uploadPersistenceRepository: this.ctx.uploadPersistenceRepository,
      organizationOnboardingService: this.ctx.organizationOnboardingService,
      domainEventSink: this.ctx.domainEventSink,
      stripeConnect: this.ctx.stripeConnect,
      options: this.ctx.options,
    };
  }

  private async validateConnectStep(
    entityId: string,
  ): Promise<OnboardingStepCompleteResult | { ok: true }> {
    if (this.ctx.stripeConnect?.isConfigured()) {
      try {
        await this.ctx.stripeConnect.syncAccountFromStripe(entityId);
      } catch {
        return { ok: false, code: "connect_sync_failed" };
      }
    }

    const connectRow = await this.ctx.onboardingRepo.findOrganisationById(entityId);
    if (!connectRow) return { ok: false, code: "not_found" };
    return evaluateConnectStepReadiness(connectRow);
  }
}
