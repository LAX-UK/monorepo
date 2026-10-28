import type {
  ItemSubmission,
  ItemSubmissionStatus,
  LegalEntity,
  LegalEntityMemberRole,
  LegalEntitySummary,
  Lot,
  LotStatus,
} from "@auction/types";
import { Hono } from "hono";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { SubmissionError } from "../lib/errors.js";
import { ConsignmentAfterSaleHttpApplicationService } from "../services/consignment-after-sale/consignment-after-sale-http-application.service.js";
import { ConsignmentMoveService } from "../services/consignment-after-sale/consignment-move.service.js";
import { ConsignmentWithdrawalService } from "../services/consignment-after-sale/consignment-withdrawal.service.js";
import { SellerIdentityReminderService } from "../services/consignment-after-sale/seller-identity-reminder.service.js";
import { UnsoldLotChoiceService } from "../services/consignment-after-sale/unsold-lot-choice.service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { InMemoryConsignmentAgreements } from "../testing/in-memory-consignment-agreements.js";
import { InMemoryUnsoldLotChoices } from "../testing/in-memory-unsold-lot-choices.js";
import { passThroughAccountOnboarding } from "../testing/pass-through-account-onboarding.middleware.js";
import { stubSubmissionRouteServices } from "../testing/stub-submission-route-services.js";
import { createSubmissionRoutes } from "./submissions.js";

const entityId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const otherEntityId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const galleryId = "99999999-9999-4999-8999-999999999999";
const submissionId = "33333333-3333-4333-8333-333333333333";
const lotId = "44444444-4444-4444-8444-444444444444";
const endTime = new Date("2026-10-20T18:00:00Z");

type Setup = {
  role?: LegalEntityMemberRole;
  isImpersonation?: boolean;
  userRole?: string;
  submissionStatus?: ItemSubmissionStatus;
  submissionEntityId?: string;
  lotStatus?: LotStatus | null;
  winnerId?: string | null;
  floor?: string | null;
  accepted?: boolean;
  sourceKind?: "individual" | "organisation";
  galleryRole?: LegalEntityMemberRole;
  identityReminderSentAt?: Date | null;
  identityVerified?: boolean;
};

function setup(options: Setup = {}) {
  const submission = {
    id: submissionId,
    legalEntityId: options.submissionEntityId ?? entityId,
    title: "Untitled (Blue)",
    status: options.submissionStatus ?? "converted",
    convertedLotId: options.lotStatus === null ? null : lotId,
    identityReminderSentAt: options.identityReminderSentAt ?? null,
  } as ItemSubmission;
  const lot = {
    id: lotId,
    title: "Untitled (Blue)",
    status: options.lotStatus ?? "ended",
    winnerId: options.winnerId ?? null,
    reservePrice: "5000.00",
    endTime,
    sellerLegalEntityId: entityId,
  } as Lot;
  const submissions = {
    findById: vi.fn(async (id: string) => (id === submissionId ? submission : null)),
  };
  const lots = { findById: vi.fn(async () => (options.lotStatus === null ? null : lot)) };
  const agreements = new InMemoryConsignmentAgreements();
  agreements.seed({
    submissionId,
    legalEntityId: submission.legalEntityId ?? entityId,
    relistReserveFloor: options.floor ?? "3000.00",
    ...(options.accepted
      ? { acceptedAt: new Date("2026-10-02T10:00:00Z"), acceptedByUserId: "u1" }
      : {}),
  });
  const choices = new InMemoryUnsoldLotChoices();
  const notifier = { notify: vi.fn().mockResolvedValue(undefined) };
  const events = { publish: vi.fn().mockResolvedValue(undefined), withTx: vi.fn() };
  const withdrawSubmission = vi.fn().mockResolvedValue(ok(submission));
  const requestLotWithdrawal = vi.fn().mockResolvedValue(ok({ alreadyPending: false }));
  const entities = new Map<string, LegalEntity>([
    [
      entityId,
      {
        id: entityId,
        kind: options.sourceKind ?? "individual",
        status: "approved",
        displayName: "Jane Smith",
      } as LegalEntity,
    ],
    [
      galleryId,
      {
        id: galleryId,
        kind: "organisation",
        status: "approved",
        displayName: "Northbank Gallery",
      } as LegalEntity,
    ],
  ]);
  const memberships: LegalEntitySummary[] = [
    {
      id: entityId,
      kind: "individual",
      status: "approved",
      displayName: "Jane Smith",
      role: "owner",
    } as LegalEntitySummary,
    {
      id: galleryId,
      kind: "organisation",
      status: "approved",
      displayName: "Northbank Gallery",
      role: options.galleryRole ?? "admin",
    } as LegalEntitySummary,
  ];
  const writer = { move: vi.fn().mockResolvedValue(true) };
  const store = { markSent: vi.fn().mockResolvedValue(true) };
  const now = () => new Date("2026-10-28T12:00:00Z");

  const http = new ConsignmentAfterSaleHttpApplicationService({
    submissions,
    unsold: new UnsoldLotChoiceService({
      choices,
      submissions,
      lots,
      agreements,
      people: { findById: vi.fn().mockResolvedValue({ name: "Jane Smith" }) },
      notifier,
      events,
      now,
    }),
    withdrawal: new ConsignmentWithdrawalService({
      submissions,
      lots,
      withdrawalTasks: { findLatestLotWithdrawal: vi.fn().mockResolvedValue(null) },
      withdrawSubmission,
      requestLotWithdrawal,
      notifier,
      events,
    }),
    move: new ConsignmentMoveService({
      submissions,
      entities: { findById: vi.fn(async (id: string) => entities.get(id) ?? null) },
      memberships: { listActiveMembershipsForUser: vi.fn().mockResolvedValue(memberships) },
      personOf: vi.fn().mockResolvedValue("u1"),
      agreements,
      writer,
      notifier,
      events,
      now,
    }),
    reminder: new SellerIdentityReminderService({
      submissions,
      identity: {
        factsFor: vi.fn().mockResolvedValue({
          kind: "individual",
          kycStatus: options.identityVerified ? "approved" : "pending",
        }),
      },
      store,
      notifier,
      events,
      now,
    }),
  });

  const container = {
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    requireSubmissionsLegalEntityContext: vi.fn((c, next) => {
      c.set("legalEntityContext", {
        legalEntityId: entityId,
        userId: "u1",
        role: options.role ?? "owner",
        ...(options.isImpersonation ? { isImpersonation: true } : {}),
      });
      return next();
    }),
    submissionRoutes: stubSubmissionRouteServices({ afterSaleHttp: http }),
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({
      id: "u1",
      role: options.userRole ?? "client",
      ...(options.userRole === "staff" ? { staffRole: "super_admin" } : {}),
      scopes: ["bid.read", "bid.write"],
    }),
  };
  const app = new Hono();
  app.route(
    "/submissions",
    createSubmissionRoutes(container, authenticator, passThroughAccountOnboarding),
  );
  const post = (path: string, body: unknown = {}) =>
    app.request(`http://t/submissions/${submissionId}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const get = (path: string) => app.request(`http://t/submissions/${submissionId}${path}`);
  return {
    app,
    post,
    get,
    choices,
    notifier,
    events,
    writer,
    store,
    withdrawSubmission,
    requestLotWithdrawal,
  };
}

async function json<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

describe("POST /submissions/:id/unsold-choice", () => {
  it.each(["owner", "admin"] as const)("records an organisation %s's choice", async (role) => {
    const { post, choices, notifier, events } = setup({ role });
    const res = await post("/unsold-choice", { choice: "relist", reserve: "4000" });
    expect(res.status).toBe(200);
    const body = await json<{ data: { status: string; requestedReserve: string } }>(res);
    expect(body.data).toMatchObject({ status: "requested", requestedReserve: "4000" });
    expect(choices.writes).toBe(1);
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "submission.unsold_choice_requested" }),
    );
    expect(notifier.notify).toHaveBeenCalledWith(
      [{ legalEntityId: entityId, audience: "seller" }],
      expect.objectContaining({ title: "We have your choice" }),
    );
  });

  it.each(["consignor", "finance", "viewer", "buyer_agent"] as const)(
    "refuses a %s and says who can choose",
    async (role) => {
      const { post, choices } = setup({ role });
      const res = await post("/unsold-choice", { choice: "collect" });
      expect(res.status).toBe(403);
      expect((await json<{ error: string }>(res)).error).toBe(
        "Only an owner or admin can choose what happens next.",
      );
      expect(choices.writes).toBe(0);
    },
  );

  it("refuses every write while an admin impersonates the account", async () => {
    const impersonating = setup({ isImpersonation: true });
    expect((await impersonating.post("/unsold-choice", { choice: "collect" })).status).toBe(403);
    const staff = setup({ userRole: "staff", isImpersonation: true });
    expect((await staff.post("/unsold-choice", { choice: "collect" })).status).toBe(403);
    expect((await staff.post("/withdrawal")).status).toBe(403);
    expect(impersonating.choices.writes + staff.choices.writes).toBe(0);
  });

  it("treats a consignment in another account as not found", async () => {
    const { post } = setup({ submissionEntityId: otherEntityId });
    expect((await post("/unsold-choice", { choice: "collect" })).status).toBe(404);
  });

  it("refuses while the lot has not ended unsold", async () => {
    expect(
      (await setup({ lotStatus: "active" }).post("/unsold-choice", { choice: "collect" })).status,
    ).toBe(409);
    expect(
      (await setup({ winnerId: "buyer" }).post("/unsold-choice", { choice: "collect" })).status,
    ).toBe(409);
  });

  it("refuses a reserve below the specialist's floor", async () => {
    const res = await setup({ floor: "4500" }).post("/unsold-choice", {
      choice: "relist",
      reserve: "4000",
    });
    expect(res.status).toBe(400);
    expect((await json<{ code: string }>(res)).code).toBe("reserve_below_floor");
  });
});

describe("GET /submissions/:id/after-sale", () => {
  it("says what the person may do, by capability", async () => {
    const owner = await json<{
      data: { unsold: { canChoose: boolean; reserveFloor: string }; withdrawal: { path: string } };
    }>(await setup({ role: "owner" }).get("/after-sale"));
    expect(owner.data.unsold).toMatchObject({ canChoose: true, reserveFloor: "3000.00" });
    expect(owner.data.withdrawal.path).toBe("unavailable");
    const consignor = await json<{ data: { unsold: { canChoose: boolean } } }>(
      await setup({ role: "consignor" }).get("/after-sale"),
    );
    expect(consignor.data.unsold.canChoose).toBe(false);
  });
});

describe("staff confirmation", () => {
  it("is for staff with submissions access only", async () => {
    const res = await setup({}).post("/unsold-choice/decision", { choice: "relist" });
    expect(res.status).toBe(403);
  });

  it("keeps a confirmed choice: the seller can no longer change it", async () => {
    const seller = setup({});
    expect((await seller.post("/unsold-choice", { choice: "relist" })).status).toBe(200);
    await seller.choices.saveDecision({
      lotId,
      lotEndTime: endTime,
      submissionId,
      legalEntityId: entityId,
      currency: "GBP",
      choice: "relist",
      reserve: null,
      note: null,
      decidedByUserId: "specialist",
      decidedAt: new Date("2026-10-28T12:00:00Z"),
    });
    const res = await seller.post("/unsold-choice", { choice: "collect" });
    expect(res.status).toBe(409);
    expect((await json<{ code: string }>(res)).code).toBe("already_confirmed");
  });

  it("asks staff for a note before they change what the seller asked", async () => {
    const s = setup({ userRole: "staff" });
    await s.choices.saveRequest({
      lotId,
      lotEndTime: endTime,
      submissionId,
      legalEntityId: entityId,
      currency: "GBP",
      choice: "relist",
      reserve: "4000",
      requestedByUserId: "u1",
      requestedAt: new Date("2026-10-27T12:00:00Z"),
    });
    const bare = await s.post("/unsold-choice/decision", { choice: "private_sale" });
    expect((await json<{ code: string }>(bare)).code).toBe("note_required");
    const noted = await s.post("/unsold-choice/decision", {
      choice: "private_sale",
      note: "A private buyer has asked about it.",
    });
    expect(noted.status).toBe(200);
    expect((await json<{ data: { staffNote: string } }>(noted)).data.staffNote).toBe(
      "A private buyer has asked about it.",
    );
  });

  it("lets staff record an outcome and refuses a second confirmation", async () => {
    const s = setup({ userRole: "staff" });
    expect(
      (await s.post("/unsold-choice/decision", { choice: "relist", reserve: "4200" })).status,
    ).toBe(200);
    expect((await s.post("/unsold-choice/decision", { choice: "collect" })).status).toBe(409);
    expect(s.events.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "submission.unsold_choice_confirmed" }),
    );
    expect(s.notifier.notify).toHaveBeenCalledWith(
      [{ legalEntityId: entityId, audience: "seller" }],
      expect.objectContaining({
        message: '"Untitled (Blue)" will be relisted with a reserve of £4,200.',
      }),
    );
  });

  it("sets the relist floor", async () => {
    const s = setup({ userRole: "staff" });
    const res = await s.post("/relist-floor", { floor: "2500" });
    expect(res.status).toBe(200);
    expect(
      (await json<{ data: { relistReserveFloor: string } }>(res)).data.relistReserveFloor,
    ).toBe("2500");
  });
});

describe("POST /submissions/:id/withdrawal", () => {
  it.each(["owner", "admin", "consignor"] as const)(
    "lets a %s withdraw before cataloguing",
    async (role) => {
      const s = setup({ role, submissionStatus: "under_review", lotStatus: null });
      const res = await s.post("/withdrawal");
      expect(res.status).toBe(200);
      expect((await json<{ data: { kind: string } }>(res)).data.kind).toBe("withdrawn");
      expect(s.withdrawSubmission).toHaveBeenCalledWith(entityId, submissionId);
      expect(s.events.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "submission.withdrawn" }),
      );
    },
  );

  it("refuses a viewer before cataloguing", async () => {
    const s = setup({ role: "viewer", submissionStatus: "submitted", lotStatus: null });
    expect((await s.post("/withdrawal")).status).toBe(403);
    expect(s.withdrawSubmission).not.toHaveBeenCalled();
  });

  it("asks staff for a catalogued lot, owners and admins only", async () => {
    const owner = setup({ role: "owner", lotStatus: "scheduled" });
    const res = await owner.post("/withdrawal");
    expect(res.status).toBe(200);
    expect((await json<{ data: { kind: string } }>(res)).data.kind).toBe("requested");
    expect(owner.requestLotWithdrawal).toHaveBeenCalledWith("u1", lotId);
    const consignor = setup({ role: "consignor", lotStatus: "scheduled" });
    expect((await consignor.post("/withdrawal")).status).toBe(403);
    expect(consignor.requestLotWithdrawal).not.toHaveBeenCalled();
  });

  it("has nothing to withdraw once the lot ended", async () => {
    expect((await setup({ lotStatus: "ended" }).post("/withdrawal")).status).toBe(409);
  });
});

describe("staff move a personal consignment", () => {
  const staff = { userRole: "staff", submissionStatus: "approved" as const, lotStatus: null };

  it("offers only organisations the seller could hand the work in for", async () => {
    const res = await setup({ ...staff }).get("/move-options");
    const body = await json<{ data: { movable: boolean; options: { legalEntityId: string }[] } }>(
      res,
    );
    expect(body.data.movable).toBe(true);
    expect(body.data.options.map((o) => o.legalEntityId)).toEqual([galleryId]);
    const viewer = await json<{ data: { movable: boolean; options: unknown[] } }>(
      await setup({ ...staff, galleryRole: "viewer" }).get("/move-options"),
    );
    expect(viewer.data).toMatchObject({ movable: false, options: [] });
  });

  it("moves it, resets a personal acceptance and tells both sides", async () => {
    const s = setup({ ...staff, accepted: true });
    const res = await s.post("/move", { legalEntityId: galleryId });
    expect(res.status).toBe(200);
    expect((await json<{ data: { agreement: string } }>(res)).data.agreement).toBe("reset");
    expect(s.writer.move).toHaveBeenCalledWith(
      expect.objectContaining({
        fromLegalEntityId: entityId,
        toLegalEntityId: galleryId,
        resetAgreementAcceptance: true,
      }),
    );
    expect(s.events.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "submission.moved_to_organisation" }),
    );
    expect(s.notifier.notify).toHaveBeenCalledWith(
      [
        { legalEntityId: entityId, audience: "admin" },
        { legalEntityId: galleryId, audience: "admin" },
      ],
      expect.objectContaining({ title: "Moved to Northbank Gallery" }),
    );
  });

  it("refuses a catalogued work, an organisation's consignment and a role that cannot submit", async () => {
    expect(
      (await setup({ userRole: "staff" }).post("/move", { legalEntityId: galleryId })).status,
    ).toBe(409);
    expect(
      (
        await setup({ ...staff, sourceKind: "organisation" }).post("/move", {
          legalEntityId: galleryId,
        })
      ).status,
    ).toBe(409);
    const viewer = setup({ ...staff, galleryRole: "viewer" });
    expect((await viewer.post("/move", { legalEntityId: galleryId })).status).toBe(409);
    expect(viewer.writer.move).not.toHaveBeenCalled();
  });

  it("is for staff only", async () => {
    expect(
      (await setup({ submissionStatus: "approved" }).post("/move", { legalEntityId: galleryId }))
        .status,
    ).toBe(403);
  });
});

describe("POST /submissions/:id/identity-reminder", () => {
  const staff = { userRole: "staff", submissionStatus: "under_review" as const, lotStatus: null };

  it("sends one reminder and records when", async () => {
    const s = setup({ ...staff });
    const res = await s.post("/identity-reminder");
    expect(res.status).toBe(200);
    expect((await json<{ data: { sent: boolean; lastSentAt: string } }>(res)).data).toMatchObject({
      sent: true,
      lastSentAt: "2026-10-28T12:00:00.000Z",
    });
    expect(s.store.markSent).toHaveBeenCalledTimes(1);
    expect(s.notifier.notify).toHaveBeenCalledTimes(1);
  });

  it("sends nothing again inside a day", async () => {
    const s = setup({ ...staff, identityReminderSentAt: new Date("2026-10-28T09:00:00Z") });
    const res = await s.post("/identity-reminder");
    expect(
      (await json<{ data: { sent: boolean; nextAllowedAt: string } }>(res)).data,
    ).toMatchObject({
      sent: false,
      nextAllowedAt: "2026-10-29T09:00:00.000Z",
    });
    expect(s.store.markSent).not.toHaveBeenCalled();
    expect(s.notifier.notify).not.toHaveBeenCalled();
  });

  it("does not send twice when another request marked it first", async () => {
    const s = setup({ ...staff });
    s.store.markSent.mockResolvedValueOnce(false);
    const res = await s.post("/identity-reminder");
    expect((await json<{ data: { sent: boolean } }>(res)).data.sent).toBe(false);
    expect(s.notifier.notify).not.toHaveBeenCalled();
  });

  it("refuses once the identity is verified, and for clients", async () => {
    expect(
      (await setup({ ...staff, identityVerified: true }).post("/identity-reminder")).status,
    ).toBe(409);
    expect(
      (await setup({ submissionStatus: "under_review" }).post("/identity-reminder")).status,
    ).toBe(403);
  });
});

describe("refusals carry the service's message", () => {
  it("maps a submission error to its status", async () => {
    const http = new ConsignmentAfterSaleHttpApplicationService({
      submissions: { findById: vi.fn() },
      unsold: {
        request: vi.fn().mockResolvedValue(err(new SubmissionError("Nope", 418, "teapot"))),
      } as never,
      withdrawal: {} as never,
      move: {} as never,
      reminder: {} as never,
    });
    const res = await http.requestUnsoldChoice(
      submissionId,
      { userId: "u1", legalEntityId: entityId, actor: { role: "owner" } },
      { choice: "collect" },
    );
    expect(res).toEqual({ status: 418, body: { error: "Nope", code: "teapot" } });
  });
});
