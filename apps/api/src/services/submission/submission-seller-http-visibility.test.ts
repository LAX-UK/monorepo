import type { ListSubmissionsFilter } from "@auction/persistence/interfaces";
import type { ConsignmentAgreement, ItemSubmission, LegalEntityMemberRole } from "@auction/types";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { SubmissionError } from "../../lib/errors.js";
import { ConsignmentAgreementHttpApplicationService } from "../consignment-agreement/consignment-agreement-http-application.service.js";
import type { IConsignmentAgreementService } from "../consignment-agreement/consignment-agreement.service.js";
import type {
  IItemSubmissionAdminApi,
  IItemSubmissionSellerApi,
} from "../interfaces/item-submission-apis.js";
import type { ISubmissionDocumentPort } from "../interfaces/submission-routes/submission-document-port.js";
import { SubmissionAccessGuard } from "./submission-access-guard.js";
import { SubmissionDocumentHttpApplicationService } from "./submission-document-http-application.service.js";
import { SubmissionSellerHttpApplicationService } from "./submission-seller-http-application.service.js";

const ENTITY = "org-1";
const ME = "me";

/** One account with three submissions: mine, another member's, and one from before senders. */
const ROWS: Record<string, ItemSubmission> = {
  mine: {
    id: "mine",
    legalEntityId: ENTITY,
    title: "Mine",
    submittedByUserId: ME,
  } as ItemSubmission,
  other: {
    id: "other",
    legalEntityId: ENTITY,
    title: "Theirs",
    submittedByUserId: "someone-else",
  } as ItemSubmission,
  legacy: {
    id: "legacy",
    legalEntityId: ENTITY,
    title: "Old",
    submittedByUserId: null,
  } as ItemSubmission,
};

function services() {
  const submissions = {
    findById: vi.fn(async (id: string) => ROWS[id] ?? null),
    listForLegalEntity: vi.fn(async (_e: string, f: ListSubmissionsFilter) =>
      Object.values(ROWS).filter((s) => {
        const scope = f.visibleTo?.scope ?? "all";
        if (scope === "own") return s.submittedByUserId === f.visibleTo?.userId;
        if (scope === "attributed") return s.submittedByUserId != null;
        return true;
      }),
    ),
  };
  const guard = new SubmissionAccessGuard(submissions);
  const sellerApi = {
    createDraftForSellerApi: vi.fn(async (_e: string, input: unknown) => ok(input)),
    listSubmissionsForSellerApi: vi.fn(async () => ({ data: [], total: 0 })),
    getSubmissionSummaryForSellerApi: vi.fn(async () => ({ counts: {}, total: 0 })),
    getSubmissionForViewerApi: vi.fn(async (i: { submissionId: string }) =>
      ROWS[i.submissionId] ? ok(ROWS[i.submissionId]) : err(new SubmissionError("Not found", 404)),
    ),
    getForSeller: vi.fn(async (_e: string, id: string) =>
      ROWS[id] ? ok(ROWS[id]) : err(new SubmissionError("Not found", 404)),
    ),
    patchSubmissionFromRequestBody: vi.fn(async (i: { submissionId: string }) => ({
      kind: "ok" as const,
      data: ROWS[i.submissionId] as ItemSubmission,
    })),
    submitForReviewForSellerApi: vi.fn(async (_e: string, id: string) => ok(ROWS[id])),
    withdrawForSellerApi: vi.fn(async (_e: string, id: string) => ok(ROWS[id])),
  } as unknown as IItemSubmissionSellerApi;
  const documents: ISubmissionDocumentPort = {
    list: vi.fn(async () => []),
    attach: vi.fn(async () => ({}) as never),
    remove: vi.fn(async () => undefined),
  };
  const agreements = {
    getForSeller: vi.fn(async () => ok({} as never)),
    accept: vi.fn(async () => ok({} as never)),
    listForSeller: vi.fn(async () =>
      Object.keys(ROWS).map((id) => ({ submissionId: id }) as ConsignmentAgreement),
    ),
  } as unknown as IConsignmentAgreementService;
  return {
    sellerApi,
    agreements,
    seller: new SubmissionSellerHttpApplicationService(sellerApi, guard, {
      namesFor: async () => new Map<string, string>(),
    }),
    docs: new SubmissionDocumentHttpApplicationService(
      sellerApi,
      {} as IItemSubmissionAdminApi,
      documents,
      guard,
    ),
    agreementHttp: new ConsignmentAgreementHttpApplicationService(agreements, guard),
  };
}

const as = (role: LegalEntityMemberRole) => ({
  legalEntityId: ENTITY,
  member: { userId: ME, actor: { role } },
});
const seller = (role: LegalEntityMemberRole) => ({
  legalEntityId: ENTITY,
  userId: ME,
  actor: { role },
});
const viewer = { userId: ME, role: "client" };

/** Status of every client endpoint keyed by a submission id, for one member and submission. */
async function statuses(role: LegalEntityMemberRole, id: string) {
  const s = services();
  const legalEntity = as(role);
  return {
    get: (await s.seller.getById({ submissionId: id, viewer, legalEntity })).status,
    patch: (await s.seller.patch({ submissionId: id, rawBody: {}, viewer, legalEntity })).status,
    submit: (await s.seller.submitForReview({ submissionId: id, legalEntity })).status,
    withdraw: (await s.seller.withdraw({ submissionId: id, legalEntity })).status,
    listDocuments: (await s.docs.listForViewer({ submissionId: id, viewer, legalEntity })).status,
    attachDocument: (
      await s.docs.attachForViewer({
        submissionId: id,
        body: { kind: "provenance", label: null, uploadObjectId: "u" } as never,
        viewer,
        legalEntity,
      })
    ).status,
    removeDocument: (
      await s.docs.removeForViewer({ submissionId: id, documentId: "d", viewer, legalEntity })
    ).status,
    agreement: (await s.agreementHttp.getForSeller(id, seller(role))).status,
    acceptAgreement: (await s.agreementHttp.accept(id, seller(role), "v1")).status,
  };
}

function every(status: number) {
  return {
    get: status,
    patch: status,
    submit: status,
    withdraw: status,
    listDocuments: status,
    attachDocument: status === 200 ? expect.any(Number) : status,
    removeDocument: status === 200 ? 204 : status,
    agreement: status,
    acceptAgreement: status,
  };
}

describe("client endpoints keyed by a submission id, by who sent it", () => {
  it("open a consignor's own submission, which they may change and withdraw", async () => {
    expect(await statuses("consignor", "mine")).toEqual(every(200));
  });

  it.each(["finance", "viewer"] as const)(
    "let a %s read a submission but change nothing, with a reason",
    async (role) => {
      expect(await statuses(role, "other")).toEqual({
        ...every(200),
        patch: 403,
        submit: 403,
        withdraw: 403,
        attachDocument: 403,
        removeDocument: 403,
      });
      const refused = await services().seller.patch({
        submissionId: "other",
        rawBody: {},
        viewer,
        legalEntity: as(role),
      });
      expect(refused.body).toEqual({
        error: "Your role can follow this consignment but not change it.",
        code: "submission_change_not_allowed",
      });
    },
  );

  it("let support staff viewing as the client change nothing", async () => {
    const s = services();
    const legalEntity = {
      legalEntityId: ENTITY,
      member: { userId: ME, actor: { role: "admin" as const, isImpersonation: true } },
    };
    const res = await s.seller.patch({ submissionId: "other", rawBody: {}, viewer, legalEntity });
    expect(res.status).toBe(403);
    expect(s.sellerApi.patchSubmissionFromRequestBody).not.toHaveBeenCalled();
  });

  it("answer Not found for another member's submission to a consignor", async () => {
    expect(await statuses("consignor", "other")).toEqual(every(404));
  });

  it.each(["owner", "admin"] as const)(
    "open every submission for an %s, including ones with no recorded sender",
    async (role) => {
      expect(await statuses(role, "other")).toEqual(every(200));
      expect(await statuses(role, "legacy")).toEqual(every(200));
    },
  );

  it("keep submissions with no recorded sender from consignors and viewers", async () => {
    expect(await statuses("consignor", "legacy")).toEqual(every(404));
    expect((await statuses("viewer", "legacy")).get).toBe(404);
    expect((await statuses("viewer", "other")).get).toBe(200);
  });
});

describe("client lists keyed by submission", () => {
  it("narrow the agreements list to submissions the member may see", async () => {
    const s = services();
    const res = await s.agreementHttp.listForSeller(seller("consignor"));
    const ids = (res.body as { data: { submissionId: string }[] }).data.map((a) => a.submissionId);
    expect(ids).toEqual(["mine"]);
    const all = await s.agreementHttp.listForSeller(seller("owner"));
    expect((all.body as { data: unknown[] }).data).toHaveLength(3);
  });

  it("filter submission lists and counts in the query", async () => {
    const s = services();
    await s.seller.listMine({
      query: { limit: 20, offset: 0 } as never,
      legalEntity: as("consignor"),
    });
    expect(s.sellerApi.listSubmissionsForSellerApi).toHaveBeenCalledWith(
      ENTITY,
      expect.objectContaining({ visibleTo: { scope: "own", userId: ME } }),
    );
    await s.seller.getMineSummary({ legalEntity: as("viewer") });
    expect(s.sellerApi.getSubmissionSummaryForSellerApi).toHaveBeenCalledWith(ENTITY, {
      scope: "attributed",
      userId: ME,
    });
  });

  it("record who creates and who sends a submission", async () => {
    const s = services();
    await s.seller.createDraft({ body: { title: "New" } as never, legalEntity: as("consignor") });
    expect(s.sellerApi.createDraftForSellerApi).toHaveBeenCalledWith(
      ENTITY,
      expect.objectContaining({ submittedByUserId: ME }),
    );
    await s.seller.submitForReview({ submissionId: "mine", legalEntity: as("consignor") });
    expect(s.sellerApi.submitForReviewForSellerApi).toHaveBeenCalledWith(ENTITY, "mine", ME);
  });
});
