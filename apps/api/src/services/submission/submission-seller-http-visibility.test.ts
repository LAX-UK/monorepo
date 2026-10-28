import type { ItemSubmission, LegalEntityMemberRole } from "@auction/types";
import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { IItemSubmissionSellerApi } from "../interfaces/item-submission-apis.js";
import { SubmissionSellerHttpApplicationService } from "./submission-seller-http-application.service.js";

const ENTITY = "org-1";

function submission(submittedByUserId: string | null): ItemSubmission {
  return { id: "s1", legalEntityId: ENTITY, title: "Study", submittedByUserId } as ItemSubmission;
}

function setup(stored: ItemSubmission) {
  const api = {
    createDraftForSellerApi: vi.fn(async (_e: string, input: unknown) => ok(input)),
    listSubmissionsForSellerApi: vi.fn(async () => ({ data: [], total: 0 })),
    getSubmissionSummaryForSellerApi: vi.fn(async () => ({ counts: {}, total: 0 })),
    getSubmissionForViewerApi: vi.fn(async () => ok(stored)),
    getForSeller: vi.fn(async () => ok(stored)),
    submitForReviewForSellerApi: vi.fn(async () => ok(stored)),
    withdrawForSellerApi: vi.fn(async () => ok(stored)),
  } as unknown as IItemSubmissionSellerApi;
  return { api, http: new SubmissionSellerHttpApplicationService(api) };
}

const as = (role: LegalEntityMemberRole, userId = "me") => ({
  legalEntityId: ENTITY,
  member: { userId, actor: { role } },
});
const viewer = { userId: "me", role: "client" };
const query = { limit: 20, offset: 0 } as never;

describe("seller submissions by sender", () => {
  it("records who created a draft", async () => {
    const { api, http } = setup(submission(null));
    await http.createDraft({ body: { title: "Study" } as never, legalEntity: as("consignor") });
    expect(api.createDraftForSellerApi).toHaveBeenCalledWith(
      ENTITY,
      expect.objectContaining({ submittedByUserId: "me" }),
    );
  });

  it("records who sends or resubmits it", async () => {
    const { api, http } = setup(submission("me"));
    await http.submitForReview({ submissionId: "s1", legalEntity: as("consignor") });
    expect(api.submitForReviewForSellerApi).toHaveBeenCalledWith(ENTITY, "s1", "me");
  });

  it("lists only a consignor's own submissions, and everything for an owner", async () => {
    const consignor = setup(submission(null));
    await consignor.http.listMine({ query, legalEntity: as("consignor") });
    expect(consignor.api.listSubmissionsForSellerApi).toHaveBeenCalledWith(
      ENTITY,
      expect.objectContaining({ visibleTo: { scope: "own", userId: "me" } }),
    );
    await consignor.http.getMineSummary({ legalEntity: as("consignor") });
    expect(consignor.api.getSubmissionSummaryForSellerApi).toHaveBeenCalledWith(ENTITY, {
      scope: "own",
      userId: "me",
    });

    const owner = setup(submission(null));
    await owner.http.listMine({ query, legalEntity: as("owner") });
    expect(owner.api.listSubmissionsForSellerApi).toHaveBeenCalledWith(
      ENTITY,
      expect.not.objectContaining({ visibleTo: expect.anything() }),
    );
  });

  it("hides another member's submission from a consignor as not found", async () => {
    const { api, http } = setup(submission("someone-else"));
    expect(
      (await http.getById({ submissionId: "s1", viewer, legalEntity: as("consignor") })).status,
    ).toBe(404);
    expect((await http.withdraw({ submissionId: "s1", legalEntity: as("consignor") })).status).toBe(
      404,
    );
    expect(api.withdrawForSellerApi).not.toHaveBeenCalled();
  });

  it("keeps submissions with no recorded sender to owners and admins", async () => {
    const legacy = setup(submission(null));
    expect(
      (await legacy.http.getById({ submissionId: "s1", viewer, legalEntity: as("viewer") })).status,
    ).toBe(404);
    expect(
      (await legacy.http.getById({ submissionId: "s1", viewer, legalEntity: as("admin") })).status,
    ).toBe(200);
  });
});
