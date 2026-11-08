import { createEngineHarness } from "@auction/alerts/testing";
import { emailHash } from "@auction/email";
import { describe, expect, it, vi } from "vitest";
import { publishAlertConfirmed } from "./shop-alert-confirmed.js";

function recordingDb() {
  const rows: Record<string, unknown>[] = [];
  const db = {
    insert: () => ({
      values: vi.fn(async (row: Record<string, unknown>) => {
        rows.push(row);
      }),
    }),
  } as never;
  return { db, rows };
}

const tokenOf = (url: string) => new URL(url).searchParams.get("t") ?? "";

describe("publishAlertConfirmed", () => {
  it("writes a validated event with the address hash and never the address", async () => {
    const { db, rows } = recordingDb();
    const at = new Date("2026-11-03T09:00:00Z");

    await publishAlertConfirmed(
      db,
      "enforce",
    )({ subscriberId: "sub-1", product: "shop", email: "Client@Example.com", at });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      aggregateType: "alert_subscriber",
      aggregateId: "sub-1",
      eventType: "alert.subscription.confirmed",
      producer: "shop-api",
      payload: {
        schemaVersion: 1,
        emailHash: emailHash("Client@Example.com"),
        product: "shop",
        confirmedAt: "2026-11-03T09:00:00.000Z",
      },
    });
    expect(JSON.stringify(rows[0])).not.toContain("example.com");
  });

  it("emits on the Shop confirm link, on a repeat, and not for an invalid link", async () => {
    const { db, rows } = recordingDb();
    const h = createEngineHarness(undefined, {
      afterConfirm: publishAlertConfirmed(db, "enforce"),
    });
    await h.subscribe.requestAsVisitor({
      product: "bid",
      topic: "bid.new_sales",
      email: "link@example.com",
      source: "web",
    });
    const token = tokenOf(h.mailer.confirmations[0]?.confirmUrl ?? "");

    expect(await h.confirm.confirm("nope", "bid")).toBe("invalid");
    expect(rows).toHaveLength(0);
    expect(await h.confirm.confirm(token, "bid")).toBe("confirmed");
    expect(await h.confirm.confirm(token, "bid")).toBe("already_confirmed");
    expect(rows.map((r) => (r.payload as { emailHash: string }).emailHash)).toEqual([
      emailHash("link@example.com"),
      emailHash("link@example.com"),
    ]);
  });

  it("emits when a signed-in account turns alerts on, through its preferences", async () => {
    const { db, rows } = recordingDb();
    const h = createEngineHarness(undefined, {
      afterConfirm: publishAlertConfirmed(db, "enforce"),
    });
    h.accounts.set("u1", { email: "account@example.com", verified: true });

    expect(
      await h.preferences.setTopic({
        product: "bid",
        subjectId: "u1",
        topic: "bid.new_sales",
        on: true,
      }),
    ).toBe("saved");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.payload).toMatchObject({ emailHash: emailHash("account@example.com") });
  });

  it("does not emit for an unverified account or when switching off", async () => {
    const { db, rows } = recordingDb();
    const h = createEngineHarness(undefined, {
      afterConfirm: publishAlertConfirmed(db, "enforce"),
    });
    h.accounts.set("u1", { email: "a@example.com", verified: false });
    await h.preferences.setTopic({
      product: "bid",
      subjectId: "u1",
      topic: "bid.new_sales",
      on: true,
    });
    await h.preferences.setTopic({
      product: "bid",
      subjectId: "u1",
      topic: "bid.new_sales",
      on: false,
    });
    expect(rows).toHaveLength(0);
  });
});
