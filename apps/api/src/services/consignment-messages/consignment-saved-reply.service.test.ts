import { SAVED_REPLY_LIMIT } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { consignmentThreadFixture } from "../../testing/consignment-thread-fixture.js";

describe("saved replies", () => {
  it("adds, lists, renames and removes a reply, and records each change", async () => {
    const { savedReplyService, events } = consignmentThreadFixture();
    const created = await savedReplyService.create("sam", {
      title: "Valuation timing",
      body: "Hi {client first name}, we value within a week.",
    });
    expect(created).toMatchObject({ ok: true, value: { title: "Valuation timing" } });
    if (!created.ok) return;
    expect(await savedReplyService.list()).toHaveLength(1);

    const updated = await savedReplyService.update("sam", created.value.id, {
      title: "Valuation time",
      body: "We value within a week.",
    });
    expect(updated).toMatchObject({ ok: true, value: { title: "Valuation time" } });
    expect(await savedReplyService.remove("sam", created.value.id)).toEqual({
      ok: true,
      value: { removed: true },
    });
    expect(events.publish.mock.calls.map(([event]) => event.eventType)).toEqual([
      "consignment_saved_reply.created",
      "consignment_saved_reply.updated",
      "consignment_saved_reply.deleted",
    ]);
    expect(events.publish.mock.calls[0]?.[0]).toMatchObject({
      aggregateType: "consignment_saved_reply",
      actorUserId: "sam",
    });
  });

  it("refuses a title that is taken, ignoring case", async () => {
    const { savedReplyService } = consignmentThreadFixture();
    await savedReplyService.create("sam", { title: "Welcome", body: "Hi" });
    expect(
      await savedReplyService.create("sam", { title: "welcome", body: "Hello" }),
    ).toMatchObject({ ok: false, status: 409, code: "saved_reply_title_taken" });
  });

  it("stops at the limit with a message that says what to do", async () => {
    const { savedReplyService } = consignmentThreadFixture();
    for (let i = 0; i < SAVED_REPLY_LIMIT; i++) {
      await savedReplyService.create("sam", { title: `Reply ${i}`, body: "x" });
    }
    const result = await savedReplyService.create("sam", { title: "One more", body: "x" });
    expect(result).toMatchObject({ ok: false, status: 400, code: "saved_reply_limit" });
    expect(!result.ok && result.error).toMatch(/Remove one/);
  });

  it("answers Not found for a reply that is gone", async () => {
    const { savedReplyService, events } = consignmentThreadFixture();
    expect(
      await savedReplyService.update("sam", "missing", { title: "A", body: "B" }),
    ).toMatchObject({ ok: false, status: 404 });
    expect(await savedReplyService.remove("sam", "missing")).toMatchObject({
      ok: false,
      status: 404,
    });
    expect(events.publish).not.toHaveBeenCalled();
  });
});
