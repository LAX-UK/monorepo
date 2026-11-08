import { ERASED_ENQUIRY } from "@auction/domain";
import { describe, expect, it, vi } from "vitest";
import { anonymiseEnquiries } from "./anonymise-enquiries.js";

type Row = Record<string, unknown>;

/**
 * A transaction that answers by call order: the first select returns the matched enquiries, each
 * delete/update returns the next queued result, and every `set` payload is recorded.
 */
function fakeTx(input: {
  matched: Array<{ id: string; status: string }>;
  /** The deals made from the converted enquiries, answered to the second select. */
  deals?: Array<{ enquiryId: string; stage: string }>;
  detached?: Row[];
  notes?: Row[];
  enquiries?: Row[];
}) {
  const sets: Row[] = [];
  const updateResults: Row[][] = [
    ...(input.detached?.length ? [[]] : []), // upload expiry update returns nothing used
    input.notes ?? [],
    [], // private sale detail
    input.enquiries ?? [],
  ];
  const deleteResult = input.detached ?? [];
  const update = vi.fn(() => ({
    set: (values: Row) => {
      sets.push(values);
      const result = updateResults.shift() ?? [];
      const chain = {
        where: () =>
          Object.assign(Promise.resolve(result), { returning: () => Promise.resolve(result) }),
      };
      return chain;
    },
  }));
  const del = vi.fn(() => ({
    where: () => ({ returning: () => Promise.resolve(deleteResult) }),
  }));
  const answers = [input.matched, input.deals ?? []];
  const select = vi.fn(() => ({
    from: () => ({ where: () => Promise.resolve(answers.shift() ?? []) }),
  }));
  return { tx: { select, update, delete: del } as never, sets, update, del };
}

describe("anonymiseEnquiries", () => {
  it("replaces the sender details and clears the phone, and reports what changed", async () => {
    const { tx, sets } = fakeTx({
      matched: [{ id: "e1", status: "new" }],
      notes: [{ id: "n1" }],
      enquiries: [{ id: "e1" }],
    });
    const counts = await anonymiseEnquiries(tx, { kind: "email", email: "Ada@x.com" });
    expect(counts).toEqual({ enquiries: 1, notes: 1, attachments: 0, held: 0 });
    const enquirySet = sets.find((s) => "message" in s);
    expect(enquirySet).toMatchObject({
      name: ERASED_ENQUIRY.name,
      email: ERASED_ENQUIRY.email,
      phone: null,
      message: ERASED_ENQUIRY.message,
    });
    expect(sets.find((s) => "body" in s)).toEqual({ body: ERASED_ENQUIRY.note });
    // Reference, intent, department, status and routing are never in a change.
    for (const key of ["reference", "intent", "status", "departmentSlug", "assignedToUserId"]) {
      expect(enquirySet).not.toHaveProperty(key);
    }
  });

  it("detaches files and expires their records so the clean-up deletes them", async () => {
    const { tx, sets, del } = fakeTx({
      matched: [{ id: "e1", status: "in_progress" }],
      detached: [{ uploadObjectId: "u1" }, { uploadObjectId: "u2" }],
      enquiries: [{ id: "e1" }],
    });
    const counts = await anonymiseEnquiries(tx, { kind: "accounts", userIds: ["user_1"] });
    expect(counts.attachments).toBe(2);
    expect(del).toHaveBeenCalledTimes(1);
    expect(sets.some((s) => "expiresAt" in s)).toBe(true);
  });

  it("holds a converted enquiry: nothing is changed and it is counted", async () => {
    const { tx, update, del } = fakeTx({ matched: [{ id: "e1", status: "converted" }] });
    const counts = await anonymiseEnquiries(tx, { kind: "accounts", userIds: ["user_1"] });
    expect(counts).toEqual({ enquiries: 0, notes: 0, attachments: 0, held: 1 });
    expect(update).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it("erases the open enquiries and holds the converted one in the same run", async () => {
    const { tx } = fakeTx({
      matched: [
        { id: "e1", status: "closed" },
        { id: "e2", status: "converted" },
      ],
      enquiries: [{ id: "e1" }],
    });
    const counts = await anonymiseEnquiries(tx, { kind: "email", email: "a@b.co" });
    expect(counts).toMatchObject({ enquiries: 1, held: 1 });
  });

  it("does nothing for no accounts, and counts nothing the second time", async () => {
    const none = fakeTx({ matched: [] });
    expect(await anonymiseEnquiries(none.tx, { kind: "accounts", userIds: [] })).toEqual({
      enquiries: 0,
      notes: 0,
      attachments: 0,
      held: 0,
    });
    expect(none.tx.select).not.toHaveBeenCalled;
    const again = fakeTx({ matched: [{ id: "e1", status: "new" }], enquiries: [], notes: [] });
    expect(await anonymiseEnquiries(again.tx, { kind: "email", email: "a@b.co" })).toEqual({
      enquiries: 0,
      notes: 0,
      attachments: 0,
      held: 0,
    });
  });

  describe("a converted enquiry and its deal", () => {
    const converted = [{ id: "e1", status: "converted" }];

    it.each(["settled", "cancelled"])("is erased once its deal is %s", async (stage) => {
      const { tx, sets } = fakeTx({
        matched: converted,
        deals: [{ enquiryId: "e1", stage }],
        enquiries: [{ id: "e1" }],
      });
      const counts = await anonymiseEnquiries(tx, { kind: "email", email: "a@b.co" });
      expect(counts).toMatchObject({ enquiries: 1, held: 0 });
      expect(sets.find((s) => "message" in s)).toMatchObject({ name: ERASED_ENQUIRY.name });
    });

    it.each(["proposed", "offer", "agreed", "invoiced", "paid", "released"])(
      "is held while its deal is %s",
      async (stage) => {
        const { tx, update } = fakeTx({
          matched: converted,
          deals: [{ enquiryId: "e1", stage }],
        });
        const counts = await anonymiseEnquiries(tx, { kind: "email", email: "a@b.co" });
        expect(counts).toEqual({ enquiries: 0, notes: 0, attachments: 0, held: 1 });
        expect(update).not.toHaveBeenCalled();
      },
    );

    it("is held when it has no deal at all", async () => {
      const { tx, update } = fakeTx({ matched: converted });
      const counts = await anonymiseEnquiries(tx, { kind: "email", email: "a@b.co" });
      expect(counts.held).toBe(1);
      expect(update).not.toHaveBeenCalled();
    });

    it("asks for deals only when something is converted", async () => {
      const { tx } = fakeTx({
        matched: [{ id: "e1", status: "new" }],
        enquiries: [{ id: "e1" }],
      });
      await anonymiseEnquiries(tx, { kind: "email", email: "a@b.co" });
      expect(tx.select).toHaveBeenCalledTimes(1);
    });
  });
});
