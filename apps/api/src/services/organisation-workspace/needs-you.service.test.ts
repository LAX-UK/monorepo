import type { INeedsYouFactsReader } from "@auction/persistence/interfaces";
import type { LegalEntityKind, LegalEntityMemberRole, LegalEntityStatus } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { UnsoldChoiceDeadlines } from "../consignment-after-sale/unsold-choice-deadlines.js";
import { NeedsYouService } from "./needs-you.service.js";

const ENTITY = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-11-10T12:00:00Z");

type Standing = { kind: LegalEntityKind; status: LegalEntityStatus; payoutsReady: boolean };

function setup(options: { standing?: Standing | null } = {}) {
  const facts = {
    outbidLots: vi.fn(async () => [
      { id: "l1", title: "Closing lot", endsAt: new Date("2026-11-10T14:00:00Z") },
    ]),
    openPurchases: vi.fn(async () => [
      { id: "p1", title: "Lot 14", paymentStatus: null, fulfilment: null, shippingQuote: null },
    ]),
    agreementsToAccept: vi.fn(async () => [{ id: "c1", title: "Untitled" }]),
    changesRequested: vi.fn(async () => []),
    expiredInvitations: vi.fn(async () => [
      { id: "i1", email: "sam@example.com", expiredAt: new Date("2026-11-08T00:00:00Z") },
    ]),
    endingAuthorisations: vi.fn(async () => []),
    pendingAccessRequests: vi.fn(async () => [
      { id: "r1", requesterName: "Tom", askedAt: new Date("2026-11-09T00:00:00Z") },
    ]),
    unreadReplies: vi.fn(async () => [
      { id: "s2", title: "Thames at low tide", from: "Clara Mendes" },
    ]),
    viewerChecks: vi.fn(async () => ({
      identity: "required" as const,
      sourceOfFundsRequested: false,
    })),
  } satisfies INeedsYouFactsReader;
  const unsold = {
    listUnsoldOutcomes: vi.fn(async () => ({
      rows: [
        {
          lotId: "u1",
          submissionId: "s1",
          title: "Harbour",
          endedAt: new Date("2026-10-29T12:00:00Z"),
          chooseBy: null,
          choice: null,
        },
      ],
      total: 1,
    })),
  };
  const authorisations = {
    list: vi.fn(async () => [
      {
        sale: {
          id: "sale1",
          title: "Contemporary",
          startTime: "2026-11-14T10:00:00Z",
          registered: false,
        },
        bidLimit: "10000",
        validUntil: null,
      },
    ]),
  };
  const standing: Standing | null =
    options.standing === undefined
      ? { kind: "organisation", status: "approved", payoutsReady: true }
      : options.standing;
  const service = new NeedsYouService({
    facts,
    organisations: { standing: vi.fn(async () => standing) },
    unsold,
    deadlines: new UnsoldChoiceDeadlines({ warn: () => {} }),
    authorisations,
    now: () => NOW,
  });
  return { service, facts, unsold, authorisations };
}

const member = (role: LegalEntityMemberRole, isImpersonation?: boolean) => ({
  userId: "me",
  legalEntityId: ENTITY,
  role,
  isImpersonation,
});

describe("NeedsYouService", () => {
  it("owner: reads the account's facts and returns ranked tasks with links and counts", async () => {
    const { service, facts, unsold } = setup();
    const view = await service.read(member("owner"));
    expect(view.tasks.map((task) => [task.kind, task.link])).toEqual([
      ["outbid", { page: "lot", id: "l1" }],
      ["pay", { page: "purchase", id: "p1" }],
      // Ended 12 days ago: due within 3 days.
      ["unsold_due", { page: "consignments", view: "unsold" }],
      ["agreement", { page: "consignment", id: "c1" }],
      // An unread specialist message opens the consignment's messages.
      ["reply", { page: "consignment_messages", id: "s2" }],
      ["invitations_expired", { page: "team", view: "invitations" }],
      ["access_requests", { page: "team", view: "members" }],
    ]);
    expect(view.counts).toEqual({
      bids: 1,
      purchases: 1,
      consignments: 3,
      team: 2,
      organisation: 0,
    });
    expect(view.truncated).toBe(false);
    expect(facts.outbidLots).toHaveBeenCalledWith(
      expect.objectContaining({ legalEntityId: ENTITY, bidderId: null, now: NOW }),
    );
    expect(facts.agreementsToAccept).toHaveBeenCalledWith(
      expect.objectContaining({ visibleTo: undefined }),
    );
    expect(facts.unreadReplies).toHaveBeenCalledWith(
      expect.objectContaining({ legalEntityId: ENTITY, visibleTo: undefined }),
    );
    expect(unsold.listUnsoldOutcomes).toHaveBeenCalledWith(
      expect.objectContaining({ choice: "none", visibleTo: undefined }),
    );
    // Owners have no personal identity step, but source of funds is asked of anyone who buys.
    expect(facts.viewerChecks).toHaveBeenCalledWith("me");
    expect(view.tasks.some((task) => task.kind === "identity")).toBe(false);
  });

  it("buyer agent: only their own bids, wins and authorisation", async () => {
    const { service, facts } = setup();
    const view = await service.read(member("buyer_agent"));
    expect(view.tasks.map((task) => task.kind)).toEqual([
      "outbid",
      "won_awaiting_payment",
      "register",
      "identity",
    ]);
    expect(facts.outbidLots).toHaveBeenCalledWith(expect.objectContaining({ bidderId: "me" }));
    expect(facts.openPurchases).toHaveBeenCalledWith(expect.objectContaining({ winnerId: "me" }));
    expect(facts.endingAuthorisations).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "me" }),
    );
    expect(facts.agreementsToAccept).not.toHaveBeenCalled();
    expect(facts.expiredInvitations).not.toHaveBeenCalled();
    // Only owners and admins decide access requests.
    expect(facts.pendingAccessRequests).not.toHaveBeenCalled();
  });

  it("consignor: their own submissions only", async () => {
    const { service, facts } = setup();
    await service.read(member("consignor"));
    expect(facts.changesRequested).toHaveBeenCalledWith(
      expect.objectContaining({ visibleTo: { scope: "own", userId: "me" } }),
    );
    expect(facts.outbidLots).not.toHaveBeenCalled();
    expect(facts.openPurchases).not.toHaveBeenCalled();
  });

  it("viewer: reads nothing it could not act on", async () => {
    const { service, facts, unsold } = setup();
    const view = await service.read(member("viewer"));
    expect(view.kinds).toEqual(["source_of_funds"]);
    expect(facts.outbidLots).not.toHaveBeenCalled();
    expect(unsold.listUnsoldOutcomes).not.toHaveBeenCalled();
  });

  it("an impersonating admin reads nothing to do", async () => {
    const { service } = setup();
    const view = await service.read(member("admin", true));
    expect(view.tasks).toEqual([]);
  });

  it("a person's own account: the same table, its consignments asked for while it is a lead", async () => {
    const { service } = setup({
      standing: { kind: "individual", status: "lead", payoutsReady: false },
    });
    const view = await service.read(member("owner"));
    expect(view.tasks.map((task) => task.kind)).toEqual(
      expect.arrayContaining(["unsold_due", "agreement", "reply"]),
    );
    expect(view.tasks.map((task) => task.kind)).not.toContain("invitations_expired");
    expect(view.counts.consignments).toBe(3);
  });

  it("an organisation that cannot be found asks nothing", async () => {
    const { service, facts } = setup({ standing: null });
    expect((await service.read(member("owner"))).tasks).toEqual([]);
    expect(facts.outbidLots).not.toHaveBeenCalled();
  });
});
