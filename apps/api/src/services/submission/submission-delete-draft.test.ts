import type { LegalEntityMemberRole } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { SubmissionAccessGuard } from "./submission-access-guard.js";
import { SubmissionSellerHttpApplicationService } from "./submission-seller-http-application.service.js";
import { SUBMISSION_NOT_A_DRAFT, deleteDraft } from "./submission-seller-lifecycle.js";

/**
 * GAP-53 "Delete draft" (docs/design/decision-pack-2026-11-17.md section 5): `DELETE
 * /submissions/:id` for drafts only. Owners, admins and the consignor who started it may delete
 * it, as for withdraw; someone else's draft is "Not found" (404) and a sent submission is 409.
 */

const ENTITY = "org-1";
const OTHER_ENTITY = "org-2";
const ME = "me";

type Row = { id: string; legalEntityId: string; status: string; submittedByUserId: string | null };
const ROWS: Record<string, Row> = {
  myDraft: { id: "myDraft", legalEntityId: ENTITY, status: "draft", submittedByUserId: ME },
  theirDraft: {
    id: "theirDraft",
    legalEntityId: ENTITY,
    status: "draft",
    submittedByUserId: "colleague",
  },
  mySent: { id: "mySent", legalEntityId: ENTITY, status: "submitted", submittedByUserId: ME },
  elsewhere: {
    id: "elsewhere",
    legalEntityId: OTHER_ENTITY,
    status: "draft",
    submittedByUserId: ME,
  },
};

/** The repository's one-statement delete, over the rows above. */
function fakeRepository() {
  const deleted = new Set<string>();
  return {
    deleted,
    findById: vi.fn(async (id: string) => (deleted.has(id) ? null : (ROWS[id] ?? null))),
    listForLegalEntity: vi.fn(async () => []),
    softDeleteDraft: vi.fn(async (id: string, legalEntityId: string) => {
      const row = ROWS[id];
      if (!row || row.legalEntityId !== legalEntityId || deleted.has(id)) return "not_found";
      if (row.status !== "draft") return "not_draft";
      deleted.add(id);
      return "deleted";
    }),
  };
}

function service() {
  const repository = fakeRepository();
  const sellerApi = {
    deleteDraftForSellerApi: vi.fn((legalEntityId: string, id: string) =>
      deleteDraft({ submissions: repository as never }, legalEntityId, id),
    ),
  };
  const http = new SubmissionSellerHttpApplicationService(
    sellerApi as never,
    new SubmissionAccessGuard(repository as never),
    { namesFor: async () => new Map() },
  );
  return { http, sellerApi, repository };
}

const member = (role: LegalEntityMemberRole, isImpersonation = false) => ({
  legalEntityId: ENTITY,
  member: { userId: ME, actor: { role, isImpersonation } },
});

async function del(id: string, legalEntity: ReturnType<typeof member> | { legalEntityId: string }) {
  const s = service();
  const response = await s.http.deleteDraft({ submissionId: id, legalEntity });
  return { ...response, s };
}

describe("DELETE /submissions/:id (delete draft)", () => {
  it("lets the consignor who started it delete their own draft (204), and it is gone after", async () => {
    const { status, body, s } = await del("myDraft", member("consignor"));
    expect(status).toBe(204);
    expect(body).toBeNull();
    expect(s.repository.softDeleteDraft).toHaveBeenCalledWith("myDraft", ENTITY, expect.any(Date));
    const again = await s.http.deleteDraft({
      submissionId: "myDraft",
      legalEntity: member("consignor"),
    });
    expect(again.status).toBe(404);
  });

  it.each(["owner", "admin"] as const)("lets an %s delete a colleague's draft", async (role) => {
    expect((await del("theirDraft", member(role))).status).toBe(204);
  });

  it("answers Not found for a colleague's draft to a consignor, and deletes nothing", async () => {
    const { status, body, s } = await del("theirDraft", member("consignor"));
    expect(status).toBe(404);
    expect(body).toEqual({ error: "Not found" });
    expect(s.sellerApi.deleteDraftForSellerApi).not.toHaveBeenCalled();
  });

  it("answers Not found for a draft in another account, to an owner and a person alike", async () => {
    expect((await del("elsewhere", member("owner"))).status).toBe(404);
    expect((await del("elsewhere", { legalEntityId: ENTITY })).status).toBe(404);
    expect((await del("missing", member("owner"))).status).toBe(404);
  });

  it("refuses a submission that was sent with 409 and a stable code", async () => {
    const { status, body } = await del("mySent", member("owner"));
    expect(status).toBe(409);
    expect(body).toEqual({
      error: "Only a draft can be deleted. To stop a work you sent, withdraw it.",
      code: SUBMISSION_NOT_A_DRAFT,
    });
  });

  it.each(["finance", "viewer", "buyer_agent"] as const)(
    "refuses a %s, who may change no submission (403)",
    async (role) => {
      const { status, s } = await del("myDraft", member(role));
      expect(status).toBe(403);
      expect(s.sellerApi.deleteDraftForSellerApi).not.toHaveBeenCalled();
    },
  );

  it("refuses LAX support viewing the account as its client (403)", async () => {
    const { status, body } = await del("myDraft", member("owner", true));
    expect(status).toBe(403);
    expect(body).toMatchObject({ code: "submission_change_not_allowed" });
  });

  it("lets the holder of a personal account delete their draft", async () => {
    expect((await del("myDraft", { legalEntityId: ENTITY })).status).toBe(204);
  });
});
