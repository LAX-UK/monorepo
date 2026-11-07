import { describe, expect, it } from "vitest";
import { RecordingNotices, createEngineHarness } from "../testing/harness.js";
import { ConfirmService } from "./confirm.service.js";

const snapshot = { title: "Modern British and Irish Art", path: "/sales/modern" };

function tokenOf(url: string) {
  return new URL(url).searchParams.get("t") ?? "";
}

async function confirmedVisitor(
  h: ReturnType<typeof createEngineHarness>,
  email = "v@example.com",
) {
  await h.subscribe.requestAsVisitor({
    product: "bid",
    topic: "bid.new_sales",
    email,
    source: "web_home_alerts",
  });
  const msg = h.mailer.confirmations.at(-1);
  if (!msg) throw new Error("no confirmation sent");
  await h.confirm.confirm(tokenOf(msg.confirmUrl), "bid");
  return msg;
}

describe("sign-up and confirmation", () => {
  it("runs the after-confirm hook with the address, on the press and again on a repeat", async () => {
    const h = createEngineHarness();
    const lifted: string[] = [];
    const confirm = new ConfirmService({
      subscribers: h.stores,
      topics: h.stores,
      codec: h.codec,
      clock: { now: () => h.now },
      topicsToEnable: () => ["bid.new_sales"],
      afterConfirm: async (email) => {
        lifted.push(email);
      },
    });
    await h.subscribe.requestAsVisitor({
      product: "bid",
      topic: "bid.new_sales",
      email: "Opted.Out@Example.com",
      source: "web_home_alerts",
    });
    const token = tokenOf(h.mailer.confirmations[0]?.confirmUrl ?? "");
    expect(await confirm.preview(token, "bid")).toMatchObject({ state: "ready" });
    expect(lifted).toEqual([]);
    expect(await confirm.confirm(token, "bid")).toBe("confirmed");
    expect(await confirm.confirm(token, "bid")).toBe("already_confirmed");
    expect(lifted).toEqual(["opted.out@example.com", "opted.out@example.com"]);
  });

  it("does not run the hook for an invalid link", async () => {
    const h = createEngineHarness();
    let called = false;
    const confirm = new ConfirmService({
      subscribers: h.stores,
      topics: h.stores,
      codec: h.codec,
      clock: { now: () => h.now },
      topicsToEnable: () => ["bid.new_sales"],
      afterConfirm: async () => {
        called = true;
      },
    });
    expect(await confirm.confirm("not-a-token", "bid")).toBe("invalid");
    expect(called).toBe(false);
  });

  it("sends one confirmation, and no second one inside the pause", async () => {
    const h = createEngineHarness();
    const input = {
      product: "bid",
      topic: "bid.new_sales",
      email: "A@Example.com ",
      source: "web_home_alerts",
    } as const;
    await h.subscribe.requestAsVisitor(input);
    await h.subscribe.requestAsVisitor(input);
    expect(h.mailer.confirmations).toHaveLength(1);
    expect(h.mailer.confirmations[0]?.to).toBe("a@example.com");
    h.now = new Date(h.now.getTime() + 11 * 60_000);
    await h.subscribe.requestAsVisitor(input);
    expect(h.mailer.confirmations).toHaveLength(2);
  });

  it("previews a confirm link without changing anything, then confirms on the press", async () => {
    const h = createEngineHarness();
    await h.subscribe.requestAsVisitor({
      product: "bid",
      topic: "bid.new_sales",
      email: "m@example.com",
      source: "s",
    });
    const token = tokenOf(h.mailer.confirmations[0]?.confirmUrl ?? "");
    expect(await h.confirm.preview(token, "bid")).toEqual({
      state: "ready",
      maskedEmail: "m•••@example.com",
    });
    expect(await h.confirm.preview(token, "bid")).toEqual({
      state: "ready",
      maskedEmail: "m•••@example.com",
    });
    const [row] = [...h.stores.subscribersById.values()];
    expect(row?.status).toBe("pending");
    expect(await h.stores.listEmailRecipients("bid.new_sales", null, 10)).toEqual([]);

    expect(await h.confirm.confirm(token, "bid")).toBe("confirmed");
    expect([...h.stores.subscribersById.values()][0]?.status).toBe("confirmed");
    expect(await h.stores.listEmailRecipients("bid.new_sales", null, 10)).toHaveLength(1);
    expect(await h.confirm.confirm(token, "bid")).toBe("already_confirmed");
    expect(await h.confirm.preview(token, "bid")).toEqual({
      state: "already_confirmed",
      maskedEmail: "m•••@example.com",
    });
  });

  it("expires a link after 48 hours and replaces it when asked again", async () => {
    const h = createEngineHarness();
    await h.subscribe.requestAsVisitor({
      product: "bid",
      topic: "bid.new_sales",
      email: "x@example.com",
      source: "s",
    });
    const first = tokenOf(h.mailer.confirmations[0]?.confirmUrl ?? "");
    h.now = new Date(h.now.getTime() + 49 * 3_600_000);
    expect(await h.confirm.preview(first, "bid")).toEqual({ state: "expired" });
    await h.subscribe.requestAsVisitor({
      product: "bid",
      topic: "bid.new_sales",
      email: "x@example.com",
      source: "s",
    });
    expect(await h.confirm.confirm(first, "bid")).toBe("invalid");
    const second = tokenOf(h.mailer.confirmations[1]?.confirmUrl ?? "");
    expect(await h.confirm.confirm(second, "bid")).toBe("confirmed");
  });

  it("treats a link for another product or an altered link as invalid", async () => {
    const h = createEngineHarness();
    await h.subscribe.requestAsVisitor({
      product: "bid",
      topic: "bid.new_sales",
      email: "y@example.com",
      source: "s",
    });
    const token = tokenOf(h.mailer.confirmations[0]?.confirmUrl ?? "");
    expect(await h.confirm.confirm(token, "shop")).toBe("invalid");
    expect(await h.confirm.confirm(`${token}x`, "bid")).toBe("invalid");
  });

  it("is revoked by bumping the link version", async () => {
    const h = createEngineHarness();
    await h.subscribe.requestAsVisitor({
      product: "bid",
      topic: "bid.new_sales",
      email: "z@example.com",
      source: "s",
    });
    const token = tokenOf(h.mailer.confirmations[0]?.confirmUrl ?? "");
    const [row] = [...h.stores.subscribersById.values()];
    if (row) h.stores.subscribersById.set(row.id, { ...row, linkVersion: 2 });
    expect(await h.confirm.confirm(token, "bid")).toBe("invalid");
  });

  it("switches an account with a verified address on at once, and refuses an unverified one", async () => {
    const h = createEngineHarness();
    h.accounts.set("u1", { email: "Client@Example.com", verified: true });
    h.accounts.set("u2", { email: "new@example.com", verified: false });
    expect(
      await h.subscribe.enableForAccount({
        product: "bid",
        subjectId: "u1",
        topic: "bid.new_sales",
        source: "web_home_alerts",
      }),
    ).toBe("enabled");
    expect(
      await h.subscribe.enableForAccount({
        product: "bid",
        subjectId: "u2",
        topic: "bid.new_sales",
        source: "web_home_alerts",
      }),
    ).toBe("unverified");
    expect(
      await h.subscribe.enableForAccount({
        product: "bid",
        subjectId: "nobody",
        topic: "bid.new_sales",
        source: "s",
      }),
    ).toBe("no_account");
    expect(h.mailer.confirmations).toHaveLength(0);
    expect(await h.stores.listEmailRecipients("bid.new_sales", null, 10)).toHaveLength(1);
  });
});

describe("stopping", () => {
  it("previews without changing anything and stops every topic with the page's button", async () => {
    const h = createEngineHarness();
    const msg = await confirmedVisitor(h);
    const token = tokenOf(msg.stopUrl);
    const preview = await h.stop.preview(token, "bid");
    expect(preview).toMatchObject({
      state: "ready",
      maskedEmail: "v•••@example.com",
      topics: ["bid.new_sales"],
    });
    expect([...h.stores.subscribersById.values()][0]?.status).toBe("confirmed");
    expect(await h.stop.stop(token, "bid", { scope: "all" })).toBe("stopped");
    expect([...h.stores.subscribersById.values()][0]?.status).toBe("stopped");
    expect(await h.stop.stop(token, "bid", { scope: "all" })).toBe("already_stopped");
    expect(await h.stop.preview(token, "bid")).toEqual({
      state: "already_stopped",
      maskedEmail: "v•••@example.com",
    });
  });

  it("stops everything on a one-click POST, with the reason recorded", async () => {
    const h = createEngineHarness();
    const msg = await confirmedVisitor(h);
    expect(await h.stop.stopOneClick(tokenOf(msg.oneClickUrl), "bid")).toBe("stopped");
    expect([...h.stores.subscribersById.values()][0]).toMatchObject({
      status: "stopped",
      stopReason: "one_click",
    });
  });

  it("stops one topic and keeps the subscriber while another topic is on", async () => {
    const h = createEngineHarness();
    const msg = await confirmedVisitor(h);
    const [row] = [...h.stores.subscribersById.values()];
    await h.stores.setEmail(row?.id ?? "", "bid.searches", true, "person", h.now);
    const token = tokenOf(msg.stopUrl);
    expect(await h.stop.stop(token, "bid", { scope: "topic", topic: "bid.searches" })).toBe(
      "stopped",
    );
    expect([...h.stores.subscribersById.values()][0]?.status).toBe("confirmed");
    expect(await h.stop.stop(token, "bid", { scope: "topic", topic: "bid.new_sales" })).toBe(
      "stopped",
    );
    expect([...h.stores.subscribersById.values()][0]?.status).toBe("stopped");
  });

  it("rejects a stop link for another product, and a confirm link used as a stop link", async () => {
    const h = createEngineHarness();
    const msg = await confirmedVisitor(h);
    expect(await h.stop.stop(tokenOf(msg.stopUrl), "shop", { scope: "all" })).toBe("invalid");
    expect(await h.stop.stop(tokenOf(msg.confirmUrl), "bid", { scope: "all" })).toBe("invalid");
  });

  it("lets a stopped address start over with a fresh double opt-in", async () => {
    const h = createEngineHarness();
    const msg = await confirmedVisitor(h);
    await h.stop.stop(tokenOf(msg.stopUrl), "bid", { scope: "all" });
    await h.subscribe.requestAsVisitor({
      product: "bid",
      topic: "bid.new_sales",
      email: "v@example.com",
      source: "s",
    });
    expect(h.mailer.confirmations).toHaveLength(2);
    expect([...h.stores.subscribersById.values()][0]?.status).toBe("pending");
  });
});

describe("account preferences", () => {
  it("takes over a confirmed visitor sign-up for the account's verified address", async () => {
    const h = createEngineHarness();
    await confirmedVisitor(h, "client@example.com");
    h.accounts.set("u1", { email: "client@example.com", verified: true });
    const view = await h.preferences.view("bid", "u1");
    expect(view).toMatchObject({ state: "confirmed", linked: true });
    expect(view.topics).toEqual([{ topic: "bid.new_sales", emailOn: true }]);
  });

  it("turns a topic off and on again", async () => {
    const h = createEngineHarness();
    h.accounts.set("u1", { email: "client@example.com", verified: true });
    expect(
      await h.preferences.setTopic({
        product: "bid",
        subjectId: "u1",
        topic: "bid.new_sales",
        on: true,
      }),
    ).toBe("saved");
    expect((await h.preferences.view("bid", "u1")).topics).toEqual([
      { topic: "bid.new_sales", emailOn: true },
    ]);
    await h.preferences.setTopic({
      product: "bid",
      subjectId: "u1",
      topic: "bid.new_sales",
      on: false,
    });
    expect((await h.preferences.view("bid", "u1")).topics).toEqual([
      { topic: "bid.new_sales", emailOn: false },
    ]);
  });

  it("subscribes for the app alone when the email is left off", async () => {
    const h = createEngineHarness();
    h.accounts.set("u1", { email: "client@example.com", verified: true });
    await h.preferences.setTopic({
      product: "bid",
      subjectId: "u1",
      topic: "bid.new_sales",
      on: true,
      email: false,
    });
    const view = await h.preferences.view("bid", "u1");
    expect(view.state).toBe("confirmed");
    expect(view.topics).toEqual([{ topic: "bid.new_sales", emailOn: false }]);
    expect(await h.stores.listEmailRecipients("bid.new_sales", null, 10)).toEqual([]);
  });

  it("does not switch alerts back on for an address that complained", async () => {
    const h = createEngineHarness();
    h.accounts.set("u1", { email: "client@example.com", verified: true });
    await h.subscribe.enableForAccount({
      product: "bid",
      subjectId: "u1",
      topic: "bid.new_sales",
      source: "s",
    });
    const [row] = [...h.stores.subscribersById.values()];
    await h.stores.stop(row?.id ?? "", "complaint", h.now);
    const again = await h.subscribe.enableForAccount({
      product: "bid",
      subjectId: "u1",
      topic: "bid.new_sales",
      source: "s",
    });
    expect(again).toBe("blocked");
    expect(await h.stores.listEmailRecipients("bid.new_sales", null, 10)).toEqual([]);
  });

  it("reports an unverified address", async () => {
    const h = createEngineHarness();
    h.accounts.set("u1", { email: "client@example.com", verified: false });
    expect(
      await h.preferences.setTopic({
        product: "bid",
        subjectId: "u1",
        topic: "bid.new_sales",
        on: true,
      }),
    ).toBe("unverified");
    expect(await h.preferences.view("bid", "u1")).toMatchObject({ state: "none" });
  });
});

describe("announcing and the daily digest", () => {
  it("records a match for each subscriber once, and announces an item only once", async () => {
    const h = createEngineHarness();
    await confirmedVisitor(h, "a@example.com");
    await confirmedVisitor(h, "b@example.com");
    const first = await h.record.announce({
      topic: "bid.new_sales",
      itemKey: "sale:1",
      snapshot,
      announce: true,
    });
    expect(first).toEqual({ first: true, announced: true, matches: 2 });
    const again = await h.record.announce({
      topic: "bid.new_sales",
      itemKey: "sale:1",
      snapshot,
      announce: true,
    });
    expect(again).toEqual({ first: false, announced: false, matches: 0 });
  });

  it("marks an item announced without telling anyone when staff untick the box", async () => {
    const h = createEngineHarness();
    await confirmedVisitor(h);
    const quiet = await h.record.announce({
      topic: "bid.new_sales",
      itemKey: "sale:2",
      snapshot,
      announce: false,
    });
    expect(quiet).toEqual({ first: true, announced: false, matches: 0 });
    // Publishing it again later, with the box ticked, still sends nothing.
    const later = await h.record.announce({
      topic: "bid.new_sales",
      itemKey: "sale:2",
      snapshot,
      announce: true,
    });
    expect(later.matches).toBe(0);
  });

  it("finishes an announcement that was claimed but never completed", async () => {
    const h = createEngineHarness();
    await confirmedVisitor(h);
    await h.stores.claimItem("sale:7", true, h.now);
    const result = await h.record.announce({
      topic: "bid.new_sales",
      itemKey: "sale:7",
      snapshot,
      announce: true,
    });
    expect(result).toEqual({ first: false, announced: true, matches: 1 });
    expect(
      await h.record.announce({
        topic: "bid.new_sales",
        itemKey: "sale:7",
        snapshot,
        announce: true,
      }),
    ).toEqual({ first: false, announced: false, matches: 0 });
  });

  it("pages through recipients", async () => {
    const h = createEngineHarness();
    for (let i = 0; i < 3; i++) await confirmedVisitor(h, `p${i}@example.com`);
    const result = await h.record.announce({
      topic: "bid.new_sales",
      itemKey: "sale:3",
      snapshot,
      announce: true,
    });
    expect(result.matches).toBe(3);
  });

  it("sends nothing before 08:00 London, nothing when off, and previews in a dry run", async () => {
    const h = createEngineHarness(new Date("2026-11-03T07:59:00Z"));
    await confirmedVisitor(h);
    await h.record.announce({
      topic: "bid.new_sales",
      itemKey: "sale:1",
      snapshot,
      announce: true,
    });
    expect((await h.digestRun().run("on")).sent).toBe(0);
    h.now = new Date("2026-11-03T08:00:00Z");
    expect((await h.digestRun().run("off")).sent).toBe(0);
    const dry = await h.digestRun().run("dry_run");
    expect(dry).toMatchObject({ previewed: 1, sent: 0 });
    expect(h.mailer.digests).toHaveLength(0);
    const live = await h.digestRun().run("on");
    expect(live.sent).toBe(1);
    expect(h.mailer.digests[0]).toMatchObject({
      to: "v@example.com",
      audience: "visitor",
      manageUrl: null,
      localDate: "2026-11-03",
    });
    expect(h.mailer.digests[0]?.vm.subject).toBe("New sale: Modern British and Irish Art");
  });

  it("tells the digest which topics are on, so it names only those", async () => {
    const h = createEngineHarness();
    await confirmedVisitor(h);
    const [row] = [...h.stores.subscribersById.values()];
    await h.stores.setEmail(row?.id ?? "", "bid.searches", true, "person", h.now);
    await h.stores.setEmail(row?.id ?? "", "bid.artists", false, "person", h.now);
    await h.record.announce({
      topic: "bid.new_sales",
      itemKey: "sale:1",
      snapshot,
      announce: true,
    });
    await h.digestRun().run("on");
    expect([...(h.mailer.digests[0]?.activeTopics ?? [])].sort()).toEqual([
      "bid.new_sales",
      "bid.searches",
    ]);
  });

  it("sends one digest a day: a second run, and matches arriving later, wait for tomorrow", async () => {
    const h = createEngineHarness(new Date("2026-11-03T08:05:00Z"));
    await confirmedVisitor(h);
    await h.record.announce({
      topic: "bid.new_sales",
      itemKey: "sale:1",
      snapshot,
      announce: true,
    });
    await h.digestRun().run("on");
    await h.record.announce({
      topic: "bid.new_sales",
      itemKey: "sale:2",
      snapshot: { ...snapshot, title: "Prints" },
      announce: true,
    });
    const sameDay = await h.digestRun().run("on");
    expect(sameDay).toMatchObject({ sent: 0, capped: 1 });
    expect(h.mailer.digests).toHaveLength(1);
    h.now = new Date("2026-11-04T08:05:00Z");
    const nextDay = await h.digestRun().run("on");
    expect(nextDay.sent).toBe(1);
    expect(h.mailer.digests[1]?.vm.subject).toBe("New sale: Prints");
  });

  it("holds the cap across the summer clock change at London midnight", async () => {
    // 22:30 UTC on 30 June is 23:30 in London: still 30 June. 23:30 UTC is 00:30 on 1 July.
    const h = createEngineHarness(new Date("2026-06-30T22:30:00Z"));
    await confirmedVisitor(h);
    await h.record.announce({
      topic: "bid.new_sales",
      itemKey: "sale:1",
      snapshot,
      announce: true,
    });
    expect((await h.digestRun().run("on")).sent).toBe(1);
    await h.record.announce({
      topic: "bid.new_sales",
      itemKey: "sale:2",
      snapshot,
      announce: true,
    });
    h.now = new Date("2026-06-30T23:30:00Z");
    // It is now 00:30 on 1 July: before 08:00, so nothing is due, then the new day's digest goes.
    expect((await h.digestRun().run("on")).sent).toBe(0);
    h.now = new Date("2026-07-01T07:00:00Z");
    const next = await h.digestRun().run("on");
    expect(next.sent).toBe(1);
    expect(h.mailer.digests.map((d) => d.localDate)).toEqual(["2026-06-30", "2026-07-01"]);
  });

  it("sends once on the 25-hour day when clocks go back", async () => {
    const h = createEngineHarness(new Date("2026-10-25T08:00:00Z"));
    await confirmedVisitor(h);
    await h.record.announce({
      topic: "bid.new_sales",
      itemKey: "sale:1",
      snapshot,
      announce: true,
    });
    await h.digestRun().run("on");
    h.now = new Date("2026-10-25T20:00:00Z");
    await h.record.announce({
      topic: "bid.new_sales",
      itemKey: "sale:2",
      snapshot,
      announce: true,
    });
    expect((await h.digestRun().run("on")).capped).toBe(1);
    expect(h.mailer.digests).toHaveLength(1);
  });

  it("drops matches for a topic switched off or an item gone stale, and sends nothing if none remain", async () => {
    const h = createEngineHarness(new Date("2026-11-03T09:00:00Z"));
    await confirmedVisitor(h, "a@example.com");
    await confirmedVisitor(h, "b@example.com");
    await h.record.announce({
      topic: "bid.new_sales",
      itemKey: "sale:1",
      snapshot,
      announce: true,
    });
    await h.record.announce({
      topic: "bid.new_sales",
      itemKey: "sale:2",
      snapshot: { ...snapshot, title: "Withdrawn" },
      announce: true,
    });
    const [first] = [...h.stores.subscribersById.values()];
    await h.stores.setEmail(first?.id ?? "", "bid.new_sales", false, "person", h.now);
    h.stale.set("sale:2", "withdrawn");
    const stats = await h.digestRun().run("on");
    expect(stats).toMatchObject({ sent: 1, empty: 1 });
    expect(h.mailer.digests[0]?.vm.groups[0]?.total).toBe(1);
    expect(h.mailer.digests[0]?.vm.subject).toBe("New sale: Modern British and Irish Art");
  });

  it("drops matches of a subscriber who stopped, and never emails them", async () => {
    const h = createEngineHarness();
    const msg = await confirmedVisitor(h);
    await h.record.announce({
      topic: "bid.new_sales",
      itemKey: "sale:1",
      snapshot,
      announce: true,
    });
    await h.stop.stop(tokenOf(msg.stopUrl), "bid", { scope: "all" });
    const stats = await h.digestRun().run("on");
    expect(stats.sent).toBe(0);
    expect(h.mailer.digests).toHaveLength(0);
  });

  it("resends an interrupted digest under the same key and does not lose its matches", async () => {
    const h = createEngineHarness();
    await confirmedVisitor(h);
    await h.record.announce({
      topic: "bid.new_sales",
      itemKey: "sale:1",
      snapshot,
      announce: true,
    });
    h.mailer.failNextDigest = true;
    const failed = await h.digestRun().run("on");
    expect(failed.failed).toBe(1);
    expect(h.mailer.digests).toHaveLength(0);
    const retry = await h.digestRun().run("on");
    expect(retry.resumed).toBe(1);
    expect(h.mailer.digests).toHaveLength(1);
    expect(h.mailer.digests[0]?.idempotencyKey).toBe(
      `alert-digest:bid:${[...h.stores.subscribersById.keys()][0]}:2026-11-03`,
    );
    expect((await h.digestRun().run("on")).resumed).toBe(0);
  });

  it("gives an account holder a manage link and a visitor none", async () => {
    const h = createEngineHarness();
    h.accounts.set("u1", { email: "client@example.com", verified: true });
    await h.subscribe.enableForAccount({
      product: "bid",
      subjectId: "u1",
      topic: "bid.new_sales",
      source: "s",
    });
    await h.record.announce({
      topic: "bid.new_sales",
      itemKey: "sale:1",
      snapshot,
      announce: true,
    });
    await h.digestRun().run("on");
    expect(h.mailer.digests[0]).toMatchObject({
      audience: "account",
      manageUrl: "https://lax.bid/settings#alerts",
    });
  });

  describe("in-app notices", () => {
    async function accountWithMatch(h: ReturnType<typeof createEngineHarness>) {
      h.accounts.set("u1", { email: "client@example.com", verified: true });
      await h.subscribe.enableForAccount({
        product: "bid",
        subjectId: "u1",
        topic: "bid.new_sales",
        source: "s",
      });
      await h.record.announce({
        topic: "bid.new_sales",
        itemKey: "sale:1",
        snapshot,
        announce: true,
      });
    }

    it("hands a signed-in person's digest to the notice writer, with the digest and day", async () => {
      const h = createEngineHarness();
      const notices = new RecordingNotices();
      await accountWithMatch(h);
      await h.digestRun("bid", notices).run("on");
      expect(notices.written).toHaveLength(1);
      expect(notices.written[0]).toMatchObject({ subjectId: "u1", localDate: "2026-11-03" });
      expect(notices.written[0]?.vm.totalItems).toBe(1);
    });

    it("writes none for a visitor, in a dry run, or when the day's digest is already taken", async () => {
      const visitor = createEngineHarness();
      const visitorNotices = new RecordingNotices();
      await confirmedVisitor(visitor);
      await visitor.record.announce({
        topic: "bid.new_sales",
        itemKey: "sale:1",
        snapshot,
        announce: true,
      });
      await visitor.digestRun("bid", visitorNotices).run("on");
      expect(visitorNotices.written).toHaveLength(0);

      const h = createEngineHarness();
      const notices = new RecordingNotices();
      await accountWithMatch(h);
      await h.digestRun("bid", notices).run("dry_run");
      expect(notices.written).toHaveLength(0);
      await h.digestRun("bid", notices).run("on");
      await h.record.announce({
        topic: "bid.new_sales",
        itemKey: "sale:2",
        snapshot: { ...snapshot, title: "Prints" },
        announce: true,
      });
      await h.digestRun("bid", notices).run("on");
      expect(notices.written).toHaveLength(1);
    });

    it("never holds back the email when the notice fails", async () => {
      const h = createEngineHarness();
      const notices = new RecordingNotices();
      await accountWithMatch(h);
      notices.failNext = true;
      await h.digestRun("bid", notices).run("on");
      expect(h.mailer.digests).toHaveLength(1);
      expect(notices.written).toHaveLength(0);
    });
  });
});
