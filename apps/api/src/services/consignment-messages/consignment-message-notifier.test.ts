import type { ConsignmentThreadSubject } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { ConsignmentMessageNotifier, noticeExcerpt } from "./consignment-message-notifier.js";

const subject: ConsignmentThreadSubject = {
  submissionId: "s1",
  title: "Thames at low tide",
  referenceNumber: 2041,
  submittedByUserId: "lena",
  account: { id: "acct", name: "Northbank Gallery", kind: "organisation", status: "approved" },
  specialist: { userId: "clara", name: "Clara Mendes" },
  saleId: null,
};

function setup(audiences: { seller: string[]; admin: string[] }) {
  const dispatcher = { dispatch: vi.fn().mockResolvedValue(undefined) };
  const recipients = {
    listUserIdsForAudience: vi.fn(async (_id: string, audience: "seller" | "finance" | "admin") =>
      audience === "seller" ? audiences.seller : audience === "admin" ? audiences.admin : [],
    ),
  };
  return { dispatcher, notifier: new ConsignmentMessageNotifier(dispatcher, recipients) };
}

describe("ConsignmentMessageNotifier", () => {
  it("a specialist's message reaches owners, admins and the member who sent the work, as the account", async () => {
    const { dispatcher, notifier } = setup({
      seller: ["olivia", "adam", "lena", "other-consignor"],
      admin: ["olivia", "adam"],
    });
    await notifier.specialistWrote({
      subject,
      authorName: "Clara Mendes",
      body: "The agreement is ready.",
      fileCount: 0,
    });
    const recipients = dispatcher.dispatch.mock.calls.map(([userId]) => userId).sort();
    expect(recipients).toEqual(["adam", "lena", "olivia"]);
    expect(dispatcher.dispatch).toHaveBeenCalledWith("lena", {
      type: "consignment_message",
      title: "Reply from Clara Mendes",
      message: "“Thames at low tide”: The agreement is ready.",
      submissionId: "s1",
      legalEntityId: "acct",
    });
  });

  it("a client's message reaches the assigned specialist, for Bid admin", async () => {
    const { dispatcher, notifier } = setup({ seller: [], admin: [] });
    await notifier.clientWrote({ subject, authorName: "Lena Fischer", body: "", fileCount: 1 });
    expect(dispatcher.dispatch).toHaveBeenCalledWith("clara", {
      type: "consignment_message",
      title: "Lena Fischer (Northbank Gallery) wrote about “Thames at low tide”",
      message: "Sent a file.",
      submissionId: "s1",
      legalEntityId: null,
      meta: { audience: "staff" },
    });
  });

  it("nobody is told when no specialist is assigned yet; the inbox lists it as unassigned", async () => {
    const { dispatcher, notifier } = setup({ seller: [], admin: [] });
    await notifier.clientWrote({
      subject: { ...subject, specialist: null },
      authorName: "Lena Fischer",
      body: "Hello",
      fileCount: 0,
    });
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it("a failed delivery never throws", async () => {
    const { dispatcher, notifier } = setup({ seller: ["olivia"], admin: ["olivia"] });
    dispatcher.dispatch.mockRejectedValue(new Error("down"));
    await expect(
      notifier.specialistWrote({ subject, authorName: "Clara", body: "Hi", fileCount: 0 }),
    ).resolves.toBeUndefined();
  });

  it("excerpts long messages", () => {
    const excerpt = noticeExcerpt({ body: "word ".repeat(100), fileCount: 0 });
    expect(excerpt.length).toBe(140);
    expect(excerpt.endsWith("…")).toBe(true);
    expect(noticeExcerpt({ body: "", fileCount: 3 })).toBe("Sent files.");
  });
});
