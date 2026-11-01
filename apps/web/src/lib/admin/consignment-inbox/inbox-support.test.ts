import type { ConsignmentThreadDetail } from "@auction/validators";
import { describe, expect, it } from "vitest";
import { assignableStaffItems } from "./assign-options";
import {
  type StaffComposerFile,
  attachBlockedReason,
  attachmentErrorSentence,
  fileProblem,
  readyAttachments,
  sendBlockedReason,
} from "./composer-files";
import { replyRolesSentence } from "./inbox-access";
import { inboxDashboardQueues } from "./inbox-dashboard";
import { inboxEmptyState } from "./inbox-empty-states";
import { clientFacts, consignmentFacts } from "./thread-facts";

const MB = 1024 * 1024;

describe("composer files", () => {
  it("names what is wrong with a file", () => {
    expect(fileProblem({ name: "scan.tif", type: "image/tiff", size: 32 * MB })).toBe(
      "32.0 MB and TIF isn’t accepted",
    );
    expect(fileProblem({ name: "photo.heic", type: "image/heic", size: MB })).toBe(
      "HEIC isn’t accepted, use JPG, PNG, WebP or PDF",
    );
    expect(fileProblem({ name: "big.jpg", type: "image/jpeg", size: 20 * MB })).toBe(
      "20.0 MB, the limit is 15 MB",
    );
    expect(fileProblem({ name: "ok.pdf", type: "application/pdf", size: MB })).toBeNull();
  });

  const file = (patch: Partial<StaffComposerFile>): StaffComposerFile => ({
    id: "f",
    name: "a.jpg",
    kind: "image",
    size: "1 MB",
    status: "ready",
    progress: null,
    uploadObjectId: "u1",
    error: null,
    ...patch,
  });

  it("never lets a rejected file block Send", () => {
    const files = [file({}), file({ id: "r", status: "rejected", error: "HEIC isn’t accepted" })];
    expect(sendBlockedReason("", files)).toBeNull();
    expect(readyAttachments(files)).toEqual([{ uploadObjectId: "u1", fileName: "a.jpg" }]);
    expect(attachmentErrorSentence(files)).toBe(
      "a.jpg can’t be sent: HEIC isn’t accepted. Photos (JPG, PNG, WebP) or PDFs, up to 15 MB each. Send goes without it.",
    );
  });

  it("holds Send while a file uploads, or when there is nothing to send", () => {
    expect(sendBlockedReason("Hi", [file({ status: "uploading" })])).toBe(
      "Wait until the files are checked",
    );
    expect(sendBlockedReason("  ", [])).toBe("Write a message or attach a file");
  });

  it("stops attaching at five files", () => {
    expect(attachBlockedReason(Array.from({ length: 5 }, (_, i) => file({ id: `${i}` })))).toBe(
      "Up to 5 files on one message",
    );
  });
});

describe("replyRolesSentence", () => {
  it("names the reply roles from the capability matrix", () => {
    expect(replyRolesSentence()).toBe(
      "Replies need the Sales manager, Specialist or Client services role. Ask an Administrator in Staff.",
    );
  });
});

describe("inboxDashboardQueues", () => {
  const summary = {
    unanswered: 5,
    mine: { waiting: 4, overdue: 1, oldestWaitingSince: "2026-10-30T10:00:00Z" },
    unassigned: {
      waiting: 1,
      oldestWaitingSince: "2026-11-02T09:00:00Z",
      oldestAccountName: "Cedar & Stone Fine Art",
    },
  };
  const now = new Date("2026-11-02T13:00:00Z");

  it("shows the person's queue and, for people who assign, the unassigned one", () => {
    const items = inboxDashboardQueues(summary, { canAssign: true, now });
    expect(items.map((i) => [i.label, i.count, i.oldest, i.href])).toEqual([
      [
        "client messages waiting on you",
        4,
        "oldest 1 day 3 hours · 1 overdue",
        "/admin/inbox?view=mine",
      ],
      [
        "unassigned client message",
        1,
        "Cedar & Stone Fine Art · waiting 4 hours",
        "/admin/inbox?specialist=unassigned",
      ],
    ]);
    expect(items[0]?.tone).toBe("danger");
  });

  it("drops queues at zero and the unassigned one for read-only staff", () => {
    expect(inboxDashboardQueues(summary, { canAssign: false, now })).toHaveLength(1);
    expect(
      inboxDashboardQueues(
        { ...summary, mine: { waiting: 0, overdue: 0, oldestWaitingSince: null } },
        { canAssign: false, now },
      ),
    ).toEqual([]);
  });
});

describe("inboxEmptyState", () => {
  it("points an empty Assigned to me at the unassigned threads", () => {
    const state = inboxEmptyState("mine", {
      unanswered: 1,
      mine: { waiting: 0, overdue: 0, oldestWaitingSince: null },
      unassigned: { waiting: 1, oldestWaitingSince: null, oldestAccountName: null },
    });
    expect(state.description).toContain("1 thread is waiting unassigned");
    expect(state.action?.href).toBe("/admin/inbox?specialist=unassigned");
  });
});

describe("assignableStaffItems", () => {
  it("puts the viewer first, ticks the owner and leaves out the person being covered", () => {
    const items = assignableStaffItems(
      [
        { userId: "u3", name: "Sofia Brandt", staffRole: "client_services", openCount: 6 },
        { userId: "u2", name: "James Hale", staffRole: "specialist", openCount: 4 },
        { userId: "u1", name: "Clara Mendes", staffRole: "specialist", openCount: 9 },
      ],
      { viewerUserId: "u1", assigneeUserId: "u2", exclude: "u3" },
    );
    expect(items.map((i) => [i.label, i.description, i.current])).toEqual([
      ["Clara Mendes (you)", "Specialist · 9 open", false],
      ["James Hale", "Specialist · 4 open", true],
    ]);
  });
});

describe("thread facts", () => {
  const detail = {
    submission: { id: "s", title: "Thames at low tide", reference: "NB-2041", imageUrl: null },
    account: { id: "a", name: "Northbank Gallery", kind: "organisation" },
    facts: {
      stage: "approved",
      artistLine: null,
      sale: { id: "sale", name: "Modern British & Irish Art", startsAt: "2026-11-19T18:00:00Z" },
      lot: null,
      estimate: { low: "8000.00", high: "12000.00", currency: "GBP" },
      reserve: { amount: "7000.00", currency: "GBP" },
      agreement: { state: "proposed", proposedAt: "2026-10-29T10:00:00Z", acceptedAt: null },
    },
    people: {
      sender: { name: "Lena Fischer", role: "Consignor, sent this work" },
      alsoNotified: ["Maya Okafor", "Daniel Reyes"],
      accountConsignmentCount: 14,
    },
  } as unknown as ConsignmentThreadDetail;

  it("lists each consignment fact once and leaves out what it does not have", () => {
    const facts = consignmentFacts(detail);
    expect(facts.map((f) => f.id)).toEqual([
      "stage",
      "sale",
      "estimate",
      "reserve",
      "agreement",
      "reference",
    ]);
    expect(facts.find((f) => f.id === "stage")?.stage).toEqual({
      label: "Agreement to accept",
      tone: "warning",
      shape: "alert",
    });
    expect(facts.find((f) => f.id === "estimate")?.value).toBe("£8,000–12,000");
    expect(facts.find((f) => f.id === "reserve")?.value).toBe("£7,000");
    expect(facts.find((f) => f.id === "agreement")?.detail).toBe(
      "Waiting for an owner or admin to accept",
    );
  });

  it("describes the client and who else hears of a reply", () => {
    expect(clientFacts(detail).map((f) => [f.label, f.value, f.detail])).toEqual([
      ["Account", "Northbank Gallery", "Organisation · 14 consignments"],
      ["In this thread", "Lena Fischer", "Consignor, sent this work"],
      ["Also notified", "Maya Okafor, Daniel Reyes", "Owners and admins"],
    ]);
  });
});
