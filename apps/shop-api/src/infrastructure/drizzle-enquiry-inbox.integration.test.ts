import { shopAdminAudit } from "@auction/db/schema";
import { and, asc, eq } from "drizzle-orm";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type EnquiryInboxCursor,
  decodeEnquiryInboxCursor,
  encodeEnquiryInboxCursor,
} from "../application/enquiry-inbox-cursor.js";
import type { EnquiryInboxFilters } from "../application/ports/enquiry-inbox.repository.js";
import { importTestArtwork, integrationSuffix } from "../test-support/shop-fixtures.js";
import {
  createShopDb,
  hasShopIntegrationDb,
  setupShopIntegrationPools,
} from "../test-support/shop-integration-setup.js";
import { createDrizzleEnquiryInboxRepository } from "./drizzle-enquiry-inbox.repository.js";

const ACTOR = "integration-inbox-actor";

describe.skipIf(!hasShopIntegrationDb)("drizzle enquiry inbox repository", () => {
  let shopPool: pg.Pool;
  let ownerPool: pg.Pool;

  beforeAll(async () => {
    ({ ownerPool, shopPool } = await setupShopIntegrationPools());
  });

  afterAll(async () => {
    await shopPool.end();
    await ownerPool.end();
  });

  function setup() {
    const db = createShopDb(shopPool);
    const repo = createDrizzleEnquiryInboxRepository(db, {
      resolveMediaUrl: (value) => (value ? `https://media.test/${value}` : null),
    });
    /** A marker shared by every row of one test, so tests do not see each other's rows. */
    const marker = `inbox-${integrationSuffix("m")}`;
    return { db, repo, marker };
  }

  async function general(
    marker: string,
    input: {
      createdAt: string;
      topic?: string;
      name?: string;
      email?: string;
      message?: string;
      subject?: string;
    },
  ): Promise<string> {
    const { rows } = await ownerPool.query<{ id: string }>(
      `insert into shop_general_enquiry
         (topic, message, contact_name, contact_email, identity_subject_id, created_at)
       values ($1::shop_general_enquiry_topic, $2, $3, $4, $5, $6::timestamptz) returning id`,
      [
        input.topic ?? "general",
        `${marker} ${input.message ?? "A general question"}`,
        input.name ?? "Guest Sender",
        input.email ?? "guest@example.com",
        input.subject ?? null,
        input.createdAt,
      ],
    );
    return rows[0]?.id ?? "";
  }

  async function artwork(
    marker: string,
    artworkId: string,
    input: {
      createdAt: string;
      intent?: "enquiry" | "notify_me";
      message?: string;
      email?: string;
    },
  ): Promise<string> {
    const { rows } = await ownerPool.query<{ id: string }>(
      `insert into shop_artwork_interest
         (artwork_id, intent, message, contact_name, contact_email, created_at)
       values ($1, $2::shop_artwork_interest_intent, $3, 'Art Buyer', $5, $4::timestamptz)
       returning id`,
      [
        artworkId,
        input.intent ?? "enquiry",
        `${marker} ${input.message ?? "Is this available?"}`,
        input.createdAt,
        input.email ?? "buyer@example.com",
      ],
    );
    return rows[0]?.id ?? "";
  }

  async function everyPage(
    repo: ReturnType<typeof setup>["repo"],
    filters: EnquiryInboxFilters,
    limit: number,
  ) {
    const seen: Array<{ kind: string; id: string }> = [];
    let cursor: EnquiryInboxCursor | null = null;
    let pages = 0;
    do {
      const page = await repo.list({ filters, cursor, limit });
      seen.push(...page.items.map((item) => ({ kind: item.kind, id: item.id })));
      cursor = page.nextCursor
        ? decodeEnquiryInboxCursor(encodeEnquiryInboxCursor(page.nextCursor))
        : null;
      pages += 1;
    } while (cursor && pages < 20);
    return seen;
  }

  it("pages both kinds as one list, in a stable order across rows with the same created_at", async () => {
    const { db, repo, marker } = setup();
    const { artworkId } = await importTestArtwork(db, "inbox-union");
    const tie = "2026-02-10T09:00:00.123456Z";
    const ids = [
      ["general", await general(marker, { createdAt: tie })],
      ["general", await general(marker, { createdAt: tie })],
      ["general", await general(marker, { createdAt: tie })],
      ["artwork", await artwork(marker, artworkId, { createdAt: tie })],
      ["artwork", await artwork(marker, artworkId, { createdAt: tie })],
      ["artwork", await artwork(marker, artworkId, { createdAt: tie })],
      // Within the same millisecond as the tie, so a millisecond-precision cursor would misplace it.
      ["general", await general(marker, { createdAt: "2026-02-10T09:00:00.123001Z" })],
      ["artwork", await artwork(marker, artworkId, { createdAt: "2026-02-09T09:00:00Z" })],
    ] as const;

    const expected = [...ids]
      .sort((a, b) => {
        const rank = (row: (typeof ids)[number]) =>
          row[1] === ids[6][1] ? 1 : row === ids[7] ? 2 : 0;
        if (rank(a) !== rank(b)) return rank(a) - rank(b);
        // Same created_at: kind descending, then id descending.
        if (a[0] !== b[0]) return a[0] < b[0] ? 1 : -1;
        return a[1] < b[1] ? 1 : -1;
      })
      .map(([kind, id]) => ({ kind, id }));

    for (const limit of [1, 2, 3, 50]) {
      const seen = await everyPage(repo, { q: marker }, limit);
      expect(seen, `limit ${limit}`).toEqual(expected);
    }
  });

  it("leaves notify-me signups out of the inbox", async () => {
    const { db, repo, marker } = setup();
    const { artworkId } = await importTestArtwork(db, "inbox-notify");
    const enquiryId = await artwork(marker, artworkId, { createdAt: "2026-02-11T09:00:00Z" });
    // A second artwork so the unique (artwork, subject, intent) index does not apply anyway.
    await ownerPool.query(
      `insert into shop_artwork_interest (artwork_id, intent, contact_email, contact_name, message)
       values ($1, 'notify_me', 'notify@example.com', 'Notify', $2)`,
      [artworkId, `${marker} tell me`],
    );

    const page = await repo.list({ filters: { q: marker }, cursor: null, limit: 50 });
    expect(page.items.map((item) => item.id)).toEqual([enquiryId]);
    expect(page.counts.new).toBe(1);
    await expect(repo.getDetail("artwork", enquiryId)).resolves.not.toBeNull();
  });

  it("returns sender, assignee and artwork details on list rows", async () => {
    const { db, repo, marker } = setup();
    const { artworkId, slug } = await importTestArtwork(db, "inbox-rows");
    await ownerPool.query(`update shop_artwork set primary_image_url = 'thumb.jpg' where id = $1`, [
      artworkId,
    ]);
    const artworkEnquiry = await artwork(marker, artworkId, {
      createdAt: "2026-02-12T10:00:00Z",
      message: `${"long ".repeat(60)}`,
    });
    const member = `member-${marker}`;
    await ownerPool.query(
      "insert into shop_user_profile (identity_subject_id, email, name) values ($1, $2, $3)",
      [member, `${marker}@member.test`, "Member Name"],
    );
    const memberEnquiry = await general(marker, {
      createdAt: "2026-02-12T09:00:00Z",
      subject: member,
      name: "",
      email: "",
    });
    await ownerPool.query(
      "update shop_general_enquiry set contact_name = null, contact_email = null where id = $1",
      [memberEnquiry],
    );

    const page = await repo.list({ filters: { q: marker }, cursor: null, limit: 10 });
    const [first, second] = page.items;
    expect(first).toMatchObject({
      kind: "artwork",
      id: artworkEnquiry,
      topic: "artwork",
      status: "new",
      assignee: null,
      sender: { type: "guest", name: "Art Buyer", email: "buyer@example.com" },
      artwork: { id: artworkId, slug, thumbnailUrl: "https://media.test/thumb.jpg" },
    });
    expect(first?.excerpt.length).toBeLessThanOrEqual(160);
    expect(first?.excerpt.endsWith("…")).toBe(true);
    // A member with no typed contact details falls back to their profile.
    expect(second).toMatchObject({
      kind: "general",
      sender: { type: "member", name: "Member Name", email: `${marker}@member.test` },
      artwork: null,
    });
  });

  it("filters by kind, topic, status, assignee and text, and counts statuses ignoring the status filter", async () => {
    const { db, repo, marker } = setup();
    const { artworkId } = await importTestArtwork(db, "inbox-filter");
    const selling = await general(marker, {
      createdAt: "2026-02-13T09:00:00Z",
      topic: "selling",
      name: `100% ${marker}`,
      email: `pct-${marker}@example.com`,
    });
    const advisory = await general(marker, {
      createdAt: "2026-02-13T08:00:00Z",
      topic: "art_advisory",
      name: `Under_score ${marker}`,
      email: `under-${marker}@example.com`,
      message: "Looking for advice",
    });
    const onArtwork = await artwork(marker, artworkId, {
      createdAt: "2026-02-13T07:00:00Z",
      email: `buyer-${marker}@example.com`,
    });
    await ownerPool.query(
      `update shop_general_enquiry set status = 'in_progress', assignee_subject = $2 where id = $1`,
      [advisory, "colleague-a"],
    );
    await ownerPool.query(
      `update shop_artwork_interest set status = 'closed', closed_at = now() where id = $1`,
      [onArtwork],
    );

    const ids = async (filters: EnquiryInboxFilters) =>
      (await repo.list({ filters: { q: marker, ...filters }, cursor: null, limit: 50 })).items.map(
        (item) => item.id,
      );

    expect(await ids({ kind: "artwork" })).toEqual([onArtwork]);
    expect(await ids({ kind: "general" })).toEqual([selling, advisory]);
    expect(await ids({ topic: "selling" })).toEqual([selling]);
    expect(await ids({ topic: "artwork" })).toEqual([onArtwork]);
    expect(await ids({ status: "in_progress" })).toEqual([advisory]);
    expect(await ids({ assignee: { type: "unassigned" } })).toEqual([selling, onArtwork]);
    expect(await ids({ assignee: { type: "subject", subject: "colleague-a" } })).toEqual([
      advisory,
    ]);

    // Name, email and message are all searched, ignoring case.
    expect(await ids({ q: `PCT-${marker}` })).toEqual([selling]);
    expect(await ids({ q: `${marker} Looking` })).toEqual([advisory]);
    expect(await ids({ q: `buyer-${marker}` })).toEqual([onArtwork]);
    expect(await ids({ q: `100% ${marker}` })).toEqual([selling]);
    expect(await ids({ q: `Under_score ${marker}` })).toEqual([advisory]);
    // LIKE wildcards in the term are literal: these would match every row if they were not.
    expect(await ids({ q: `${marker.slice(0, 6)}%${marker.slice(7)}` })).toEqual([]);
    expect(await ids({ q: `Un_er_score ${marker}` })).toEqual([]);

    const counts = (
      await repo.list({ filters: { q: marker, status: "closed" }, cursor: null, limit: 1 })
    ).counts;
    expect(counts).toEqual({ new: 1, in_progress: 1, closed: 1 });
  });

  it("updates status and assignee under an expected version, and audits each change", async () => {
    const { repo, db, marker } = setup();
    const id = await general(marker, { createdAt: "2026-02-14T09:00:00Z" });
    const before = await repo.getDetail("general", id);
    expect(before?.status).toBe("new");

    const assigned = await repo.update({
      kind: "general",
      id,
      expectedVersion: before?.version ?? "",
      status: "in_progress",
      assigneeSubject: "colleague-a",
      actorSubjectId: ACTOR,
    });
    expect(assigned.status).toBe("updated");
    const afterAssign = await repo.getDetail("general", id);
    expect(afterAssign).toMatchObject({
      status: "in_progress",
      assignee: { subject: "colleague-a" },
      closedAt: null,
    });
    expect(afterAssign?.version).not.toBe(before?.version);

    // The first version is now stale.
    const stale = await repo.update({
      kind: "general",
      id,
      expectedVersion: before?.version ?? "",
      status: "closed",
      actorSubjectId: ACTOR,
    });
    expect(stale).toEqual({ status: "stale", currentVersion: afterAssign?.version });

    const closed = await repo.update({
      kind: "general",
      id,
      expectedVersion: afterAssign?.version ?? "",
      status: "closed",
      actorSubjectId: ACTOR,
    });
    expect(closed.status).toBe("updated");
    const afterClose = await repo.getDetail("general", id);
    expect(afterClose?.status).toBe("closed");
    expect(afterClose?.closedAt).not.toBeNull();
    // Closing keeps the assignee.
    expect(afterClose?.assignee?.subject).toBe("colleague-a");

    const reopened = await repo.update({
      kind: "general",
      id,
      expectedVersion: afterClose?.version ?? "",
      status: "new",
      assigneeSubject: null,
      actorSubjectId: ACTOR,
    });
    expect(reopened.status).toBe("updated");
    expect(await repo.getDetail("general", id)).toMatchObject({
      status: "new",
      assignee: null,
      closedAt: null,
    });

    const audit = await db
      .select({
        action: shopAdminAudit.action,
        capability: shopAdminAudit.capability,
        targetType: shopAdminAudit.targetType,
        beforeJson: shopAdminAudit.beforeJson,
        afterJson: shopAdminAudit.afterJson,
      })
      .from(shopAdminAudit)
      .where(and(eq(shopAdminAudit.actorSubjectId, ACTOR), eq(shopAdminAudit.targetId, id)))
      .orderBy(asc(shopAdminAudit.createdAt));
    expect(audit.map((row) => row.action)).toEqual([
      "enquiry.update",
      "enquiry.update",
      "enquiry.update",
    ]);
    expect(audit[0]).toMatchObject({
      capability: "enquiry.write",
      targetType: "shop_general_enquiry",
    });
    expect(JSON.parse(audit[0]?.beforeJson ?? "{}")).toEqual({
      status: "new",
      assigneeSubject: null,
    });
    expect(JSON.parse(audit[0]?.afterJson ?? "{}")).toEqual({
      status: "in_progress",
      assigneeSubject: "colleague-a",
    });
  });

  it("does not write, bump the version or audit when nothing would change", async () => {
    const { repo, db, marker } = setup();
    const id = await general(marker, { createdAt: "2026-02-15T09:00:00Z" });
    const before = await repo.getDetail("general", id);
    const outcome = await repo.update({
      kind: "general",
      id,
      expectedVersion: before?.version ?? "",
      status: "new",
      actorSubjectId: ACTOR,
    });
    expect(outcome).toEqual({ status: "updated", version: before?.version });
    const rows = await db
      .select({ id: shopAdminAudit.id })
      .from(shopAdminAudit)
      .where(and(eq(shopAdminAudit.actorSubjectId, ACTOR), eq(shopAdminAudit.targetId, id)));
    expect(rows).toHaveLength(0);
  });

  it("updates artwork enquiries, and refuses notify-me rows and unknown ids", async () => {
    const { repo, db, marker } = setup();
    const { artworkId } = await importTestArtwork(db, "inbox-update-artwork");
    const id = await artwork(marker, artworkId, { createdAt: "2026-02-16T09:00:00Z" });
    const detail = await repo.getDetail("artwork", id);
    expect(detail?.artwork?.id).toBe(artworkId);
    expect(
      await repo.update({
        kind: "artwork",
        id,
        expectedVersion: detail?.version ?? "",
        status: "closed",
        actorSubjectId: ACTOR,
      }),
    ).toMatchObject({ status: "updated" });

    const notifyMe = await ownerPool.query<{ id: string }>(
      `insert into shop_artwork_interest (artwork_id, intent, contact_email)
       values ($1, 'notify_me', 'notify-only@example.com') returning id`,
      [artworkId],
    );
    const notifyId = notifyMe.rows[0]?.id ?? "";
    expect(
      await repo.update({
        kind: "artwork",
        id: notifyId,
        expectedVersion: "2026-01-01T00:00:00.000000Z",
        status: "closed",
        actorSubjectId: ACTOR,
      }),
    ).toEqual({ status: "not_found" });
    expect(
      await repo.addNote({ kind: "artwork", id: notifyId, body: "x", authorSubjectId: ACTOR }),
    ).toBeNull();
    expect(
      await repo.update({
        kind: "general",
        id: "00000000-0000-4000-8000-0000000000ff",
        expectedVersion: "2026-01-01T00:00:00.000000Z",
        status: "closed",
        actorSubjectId: ACTOR,
      }),
    ).toEqual({ status: "not_found" });
  });

  it("keeps notes oldest first, audits them, and never lets the app change or remove one", async () => {
    const { repo, db, marker } = setup();
    const id = await general(marker, { createdAt: "2026-02-17T09:00:00Z" });
    await ownerPool.query(
      `insert into shop_user_profile (identity_subject_id, email, name) values ($1, $2, 'Note Author')
       on conflict (identity_subject_id) do nothing`,
      [ACTOR, `${ACTOR}@staff.test`],
    );
    await ownerPool.query(
      "insert into shop_staff_member (identity_subject_id, role) values ($1, 'account_manager') on conflict do nothing",
      [ACTOR],
    );
    const first = await repo.addNote({
      kind: "general",
      id,
      body: "Left a voicemail",
      authorSubjectId: ACTOR,
    });
    const second = await repo.addNote({
      kind: "general",
      id,
      body: "Spoke to them; viewing booked",
      authorSubjectId: ACTOR,
    });
    expect(first?.author).toEqual({
      subject: ACTOR,
      label: "Note Author",
      role: "account_manager",
    });

    const detail = await repo.getDetail("general", id);
    expect(detail?.notes.map((note) => note.body)).toEqual([
      "Left a voicemail",
      "Spoke to them; viewing booked",
    ]);

    const audit = await db
      .select({ action: shopAdminAudit.action, afterJson: shopAdminAudit.afterJson })
      .from(shopAdminAudit)
      .where(and(eq(shopAdminAudit.actorSubjectId, ACTOR), eq(shopAdminAudit.targetId, id)));
    expect(audit.map((row) => row.action)).toEqual(["enquiry.note.add", "enquiry.note.add"]);
    expect(JSON.parse(audit[0]?.afterJson ?? "{}")).toEqual({ noteId: first?.id });

    await expect(
      shopPool.query(`update shop_enquiry_note set body = 'edited' where id = $1`, [second?.id]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      shopPool.query("delete from shop_enquiry_note where id = $1", [second?.id]),
    ).rejects.toThrow(/permission denied/);
  });

  it("rejects a note over the database limit", async () => {
    const { marker } = setup();
    const id = await general(marker, { createdAt: "2026-02-18T09:00:00Z" });
    await expect(
      shopPool.query(
        `insert into shop_enquiry_note (enquiry_kind, enquiry_id, author_subject, body)
         values ('general', $1, 'someone', $2)`,
        [id, "x".repeat(5001)],
      ),
    ).rejects.toThrow(/shop_enquiry_note_body_ck/);
  });

  it("counts new and unassigned enquiries for the navigation badge", async () => {
    const { repo, marker } = setup();
    const before = await repo.summary();
    const fresh = await general(marker, { createdAt: "2026-02-19T09:00:00Z" });
    const assigned = await general(marker, { createdAt: "2026-02-19T08:00:00Z" });
    await ownerPool.query(
      `update shop_general_enquiry set assignee_subject = 'colleague-a' where id = $1`,
      [assigned],
    );
    const after = await repo.summary();
    expect(after.newCount - before.newCount).toBe(2);
    expect(after.needsAttentionCount - before.needsAttentionCount).toBe(1);

    await ownerPool.query(
      `update shop_general_enquiry set status = 'closed', closed_at = now() where id = $1`,
      [fresh],
    );
    const closed = await repo.summary();
    expect(closed.needsAttentionCount).toBe(before.needsAttentionCount);
  });
});
