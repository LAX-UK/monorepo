import type { OrgOnboardingStepKey } from "@auction/types";
import type { IIdentityOrganizationOnboardingHttpApplicationService } from "../interfaces/identity-routes/identity-organization-onboarding-http.js";
import type { IdentityHttpJson } from "../interfaces/identity-routes/identity-route-http.js";
import type { IOrganizationOnboardingFlowService } from "../organization-onboarding/onboarding-context.js";
import type { OrganizationOnboardingProfileInput } from "../organization-onboarding/org-onboarding-mappers.js";

function mapFlowError(code: string): number {
  switch (code) {
    case "not_found":
    case "document_not_found":
    case "upload_not_found":
      return 404;
    case "forbidden":
    case "user_identity_not_verified":
      return 403;
    case "duplicate_upload":
      return 409;
    case "onboarding_steps_incomplete":
      return 400;
    default:
      return 400;
  }
}

export class IdentityOrganizationOnboardingHttpApplicationService
  implements IIdentityOrganizationOnboardingHttpApplicationService
{
  constructor(
    private readonly organizationOnboardingFlowService: IOrganizationOnboardingFlowService,
  ) {}

  async getOnboarding(input: { userId: string; entityId: string }): Promise<IdentityHttpJson> {
    const data = await this.organizationOnboardingFlowService.getOnboarding(
      input.userId,
      input.entityId,
    );
    if (!data) return { status: 404, body: { error: "not_found" } };
    return { status: 200, body: { data } };
  }

  async updateProfile(input: {
    userId: string;
    entityId: string;
    body: Record<string, unknown>;
  }): Promise<IdentityHttpJson> {
    const body = input.body as {
      displayName: string;
      legalName?: string | null;
      vatNumber?: string | null;
      primaryAddress: OrganizationOnboardingProfileInput["primaryAddress"];
    };
    const res = await this.organizationOnboardingFlowService.updateProfile(
      input.userId,
      input.entityId,
      {
        displayName: body.displayName,
        legalName: body.legalName ?? null,
        vatNumber: body.vatNumber ?? null,
        primaryAddress: {
          ...body.primaryAddress,
          line2: body.primaryAddress.line2 ?? null,
          state: body.primaryAddress.state ?? null,
          isDefault: body.primaryAddress.isDefault ?? null,
        },
      },
    );
    if (!res.ok) {
      return { status: mapFlowError(res.code), body: { error: res.code } };
    }
    return { status: 200, body: { data: { updated: true } } };
  }

  async attachDocument(input: {
    userId: string;
    entityId: string;
    body: unknown;
  }): Promise<IdentityHttpJson> {
    const res = await this.organizationOnboardingFlowService.attachDocument(
      input.userId,
      input.entityId,
      input.body as Parameters<IOrganizationOnboardingFlowService["attachDocument"]>[2],
    );
    if (!res.ok) {
      const status =
        res.code === "forbidden"
          ? 403
          : res.code === "upload_not_found"
            ? 404
            : res.code === "duplicate_upload"
              ? 409
              : 400;
      return { status, body: { error: res.code } };
    }
    return { status: 201, body: { data: { id: res.id } } };
  }

  async detachDocument(input: {
    userId: string;
    entityId: string;
    documentId: string;
  }): Promise<IdentityHttpJson> {
    const res = await this.organizationOnboardingFlowService.detachDocument(
      input.userId,
      input.entityId,
      input.documentId,
    );
    if (!res.ok) {
      const status =
        res.code === "forbidden"
          ? 403
          : res.code === "not_found" || res.code === "document_not_found"
            ? 404
            : 409;
      return { status, body: { error: res.code } };
    }
    return { status: 204, body: null };
  }

  async completeStep(input: {
    userId: string;
    entityId: string;
    stepKey: OrgOnboardingStepKey;
  }): Promise<IdentityHttpJson> {
    const res =
      input.stepKey === "details"
        ? await this.organizationOnboardingFlowService.completeDetailsWithType(
            input.userId,
            input.entityId,
          )
        : await this.organizationOnboardingFlowService.completeStep(
            input.userId,
            input.entityId,
            input.stepKey,
          );
    if (!res.ok) {
      const status =
        res.code === "not_found"
          ? 404
          : res.code === "forbidden"
            ? 403
            : res.code === "connect_not_started"
              ? 400
              : 400;
      return { status, body: { error: res.code } };
    }
    return { status: 200, body: { data: { completed: true } } };
  }

  async submitForReview(input: {
    userId: string;
    entityId: string;
  }): Promise<IdentityHttpJson> {
    const res = await this.organizationOnboardingFlowService.submitForReview(
      input.userId,
      input.entityId,
    );
    if (!res.ok) {
      const status =
        res.code === "not_found"
          ? 404
          : res.code === "forbidden"
            ? 403
            : res.code === "user_identity_not_verified"
              ? 403
              : res.code === "onboarding_steps_incomplete"
                ? 400
                : 409;
      const body =
        res.code === "onboarding_steps_incomplete"
          ? { error: res.code, missingSteps: res.missingSteps }
          : { error: res.code };
      return { status, body };
    }
    return { status: 200, body: { data: { status: res.status } } };
  }
}
