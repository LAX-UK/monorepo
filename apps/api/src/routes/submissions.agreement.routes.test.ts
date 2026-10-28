import type { ItemSubmission, LegalEntityMemberRole } from "@auction/types";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { ConsignmentAgreementHttpApplicationService } from "../services/consignment-agreement/consignment-agreement-http-application.service.js";
import { ConsignmentAgreementService } from "../services/consignment-agreement/consignment-agreement.service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { SubmissionAccessGuard } from "../services/submission/submission-access-guard.js";
import { InMemoryConsignmentAgreements } from "../testing/in-memory-consignment-agreements.js";
import { passThroughAccountOnboarding } from "../testing/pass-through-account-onboarding.middleware.js";
import { stubSubmissionRouteServices } from "../testing/stub-submission-route-services.js";
import { createSubmissionRoutes } from "./submissions.js";

const entityId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const otherEntityId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const submissionId = "33333333-3333-4333-8333-333333333333";
const VERSION = "conditions-of-business-part-c-v1";

function setup(options: {
  role?: LegalEntityMemberRole;
  submissionEntityId?: string;
  accepted?: boolean;
  incomplete?: boolean;
  userRole?: string;
  status?: string;
}) {
  const agreements = new InMemoryConsignmentAgreements();
  const submissionOwner = options.submissionEntityId ?? entityId;
  agreements.seed({
    submissionId,
    legalEntityId: submissionOwner,
    estimateLow: options.incomplete ? null : "8000.00",
    estimateHigh: options.incomplete ? null : "12000.00",
    commissionPercent: options.incomplete ? null : "15.00",
    ...(options.accepted
      ? { acceptedAt: new Date("2026-10-02T10:00:00Z"), acceptedByUserId: "first-user" }
      : {}),
  });
  const events = { publish: vi.fn().mockResolvedValue(undefined), withTx: vi.fn() };
  // Sent by the signed-in member (u1), so a consignor sees it.
  const submission = {
    id: submissionId,
    legalEntityId: submissionOwner,
    status: options.status ?? "approved",
    title: "Untitled (Blue)",
    submittedByUserId: "u1",
  } as ItemSubmission;
  const submissions = {
    findById: vi.fn().mockResolvedValue(submission),
    listForLegalEntity: vi.fn().mockResolvedValue([submission]),
  };
  const service = new ConsignmentAgreementService({
    agreements,
    submissions,
    people: { findById: vi.fn().mockResolvedValue({ name: "Jane Smith" }) },
    dispatcher: { dispatch: vi.fn() },
    recipients: null,
    events,
    sellerIdentity: {
      factsFor: vi.fn().mockResolvedValue({ kind: "individual", kycStatus: "pending" }),
    },
    now: () => new Date("2026-10-05T12:00:00Z"),
  });
  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    requireSubmissionsLegalEntityContext: vi.fn((c, next) => {
      c.set("legalEntityContext", {
        legalEntityId: entityId,
        userId: "u1",
        role: options.role ?? "owner",
      });
      return next();
    }),
    submissionRoutes: stubSubmissionRouteServices({
      agreementHttp: new ConsignmentAgreementHttpApplicationService(
        service,
        new SubmissionAccessGuard(submissions),
      ),
    }),
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({
      id: "u1",
      role: options.userRole ?? "client",
      ...(options.userRole === "staff" ? { staffRoles: ["administrator"] } : {}),
      scopes: ["bid.read", "bid.write"],
    }),
  };
  const app = new Hono();
  app.route(
    "/submissions",
    createSubmissionRoutes(container, authenticator, passThroughAccountOnboarding),
  );
  const accept = (body: unknown = { termsVersion: VERSION }) =>
    app.request(`http://t/submissions/${submissionId}/agreement/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  return { app, agreements, events, accept };
}

describe("POST /submissions/:id/agreement/accept", () => {
  it.each(["owner", "admin"] as const)("lets an organisation %s accept", async (role) => {
    const { accept, agreements, events } = setup({ role });
    const res = await accept();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { acceptedByUserId: string; termsVersion: string } };
    expect(body.data.acceptedByUserId).toBe("u1");
    expect(body.data.termsVersion).toBe(VERSION);
    expect(agreements.acceptWrites).toBe(1);
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "submission.agreement_accepted" }),
    );
  });

  it.each(["consignor", "finance", "viewer", "buyer_agent"] as const)(
    "refuses a %s and says who can accept",
    async (role) => {
      const { accept, agreements } = setup({ role });
      const res = await accept();
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("Only an owner or admin can accept the consignment agreement.");
      expect(agreements.acceptWrites).toBe(0);
    },
  );

  it("treats a consignment in another account as not found", async () => {
    const { accept } = setup({ submissionEntityId: otherEntityId });
    expect((await accept()).status).toBe(404);
  });

  it("keeps the first acceptance when accepted again", async () => {
    const { accept, agreements, events } = setup({ accepted: true });
    const res = await accept();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { acceptedByUserId: string } };
    expect(body.data.acceptedByUserId).toBe("first-user");
    expect(agreements.acceptWrites).toBe(0);
    expect(events.publish).not.toHaveBeenCalled();
  });

  it("refuses a proposal that has no estimate or commission yet", async () => {
    const { accept, agreements } = setup({ incomplete: true });
    const res = await accept();
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: string }).error).toBe(
      "Your specialist hasn't sent the estimate and terms yet.",
    );
    expect(agreements.acceptWrites).toBe(0);
  });

  it("refuses a version other than the one proposed", async () => {
    const { accept } = setup({});
    const res = await accept({ termsVersion: "conditions-of-business-part-c-v0" });
    expect(res.status).toBe(409);
  });

  it("validates the body", async () => {
    const { accept } = setup({});
    expect((await accept({})).status).toBe(400);
  });
});

describe("GET /submissions/:id/agreement", () => {
  it("says whether the person may accept, by capability", async () => {
    const owner = setup({ role: "owner" });
    const ownerRes = await owner.app.request(`http://t/submissions/${submissionId}/agreement`);
    expect(((await ownerRes.json()) as { data: { canAccept: boolean } }).data.canAccept).toBe(true);
    const consignor = setup({ role: "consignor" });
    const res = await consignor.app.request(`http://t/submissions/${submissionId}/agreement`);
    const body = (await res.json()) as {
      data: { canAccept: boolean; agreement: { estimateLow: string } };
    };
    expect(body.data.canAccept).toBe(false);
    expect(body.data.agreement.estimateLow).toBe("8000.00");
  });
});

describe("staff routes", () => {
  const staff = { userRole: "staff" };

  it("show staff the agreement and whether the seller's identity is verified", async () => {
    const { app } = setup({ ...staff });
    const res = await app.request(`http://t/submissions/${submissionId}/agreement/staff`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { sellerIdentityVerified: boolean; agreement: { estimateLow: string } };
    };
    expect(body.data.sellerIdentityVerified).toBe(false);
    expect(body.data.agreement.estimateLow).toBe("8000.00");
  });

  it("let staff add the estimate and terms to an incomplete proposal", async () => {
    const { app, agreements } = setup({ ...staff, incomplete: true });
    const res = await app.request(`http://t/submissions/${submissionId}/agreement/terms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estimateLow: "9000", estimateHigh: "14000", commissionPercent: "15" }),
    });
    expect(res.status).toBe(200);
    const stored = await agreements.findBySubmissionId(submissionId);
    expect(stored).toMatchObject({
      estimateLow: "9000",
      estimateHigh: "14000",
      commissionPercent: "15",
    });
  });

  it("never rewrite terms the seller already accepted", async () => {
    const { app } = setup({ ...staff, accepted: true });
    const res = await app.request(`http://t/submissions/${submissionId}/agreement/terms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estimateLow: "9000", estimateHigh: "14000", commissionPercent: "15" }),
    });
    expect(res.status).toBe(409);
  });

  it("is for staff with submissions access only", async () => {
    const client = setup({});
    expect(
      (await client.app.request(`http://t/submissions/${submissionId}/agreement/staff`)).status,
    ).toBe(403);
  });
});
