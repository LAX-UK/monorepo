import {
  ARTIST_APPLICATION_STATUS_VALUES,
  ARTIST_APPLICATION_STEP_VALUES,
  ARTIST_APPLICATION_WORK_KIND_VALUES,
  type SaveArtistApplicationBody,
} from "@auction/shop-contracts";
import {
  ARTIST_APPLICATION_STATUSES,
  ARTIST_APPLICATION_STEPS,
  ARTIST_APPLICATION_WORK_KINDS,
  ShopDomainError,
} from "@auction/shop-domain";
import { beforeEach, describe, expect, it } from "vitest";
import { ArtistApplicationIncompleteError } from "../../errors/artist-application-incomplete-error.js";
import { StaleVersionError } from "../../errors/stale-version-error.js";
import { createInMemoryArtistApplications } from "../../test-support/in-memory-artist-applications.js";
import type { EnquiryRateLimiter } from "../enquiry-rate-limit.js";
import { createArtistApplicantService } from "./artist-applicant.service.js";
import { createArtistApplicationReviewService } from "./artist-application-review.service.js";
import type { ArtistApplicationQueueReader } from "./artist-application.ports.js";

const ARTIST = "subject-artist";
const OTHER = "subject-other";
const REVIEWER = "subject-reviewer";
const NOW = new Date("2026-10-28T12:00:00Z");

const allow: EnquiryRateLimiter = { consume: async () => ({ allowed: true }) };

function setup(options: { limited?: "upload" | "save" | "submit" } = {}) {
  const store = createInMemoryArtistApplications({ emails: { [ARTIST]: "ada@example.com" } });
  let now = NOW;
  const clock = { now: () => now };
  const block: EnquiryRateLimiter = {
    consume: async () => ({ allowed: false, retryAfterSeconds: 60 }),
  };
  const limiter = (kind: "upload" | "save" | "submit") =>
    options.limited === kind ? block : allow;
  const applicant = createArtistApplicantService({
    uow: store.uow,
    uploads: store.uploads,
    rateLimiters: { upload: limiter("upload"), save: limiter("save"), submit: limiter("submit") },
    clock,
  });
  const queue: ArtistApplicationQueueReader = {
    list: async () => {
      throw new Error("not used");
    },
    getDetail: async () => null,
    countNew: async () => 0,
  };
  const review = createArtistApplicationReviewService({
    uow: store.uow,
    queue,
    reviewers: {
      list: async () => [],
      canReview: async (subject) => subject === REVIEWER,
    },
    clock,
  });
  return {
    store,
    applicant,
    review,
    advance: (to: Date) => {
      now = to;
    },
  };
}

type Setup = ReturnType<typeof setup>;

async function addWorks(ctx: Setup, id: string, count: number) {
  for (let i = 0; i < count; i += 1) {
    const { key } = await ctx.applicant.presignImage(ARTIST, id, {
      contentType: "image/jpeg",
      byteSize: 1000,
    });
    await ctx.applicant.confirmImage(ARTIST, id, key);
  }
  const record = ctx.store.rows.get(id);
  if (!record) throw new Error("missing");
  return record;
}

function completeBody(version: number, mediaKeys: readonly string[]): SaveArtistApplicationBody {
  return {
    expectedVersion: version,
    artistName: "Ada Moreno",
    location: "Lisbon",
    website: "adamoreno.example",
    socialLinks: ["instagram.com/adamoreno", " "],
    shortBio: "Painter of coastal light.",
    statement: "I paint the hour before the tide turns.",
    representation: null,
    exhibitions: "  ",
    consentToContact: true,
    works: mediaKeys.map((mediaKey, index) => ({
      mediaKey,
      title: `Tide ${index + 1}`,
      year: 2024,
      medium: "Oil on linen",
      size: "60 × 80 cm",
      kind: "original",
    })),
  };
}

async function submittedApplication(ctx: Setup) {
  const draft = await ctx.applicant.start(ARTIST);
  const record = await addWorks(ctx, draft.id, 6);
  const saved = await ctx.applicant.save(
    ARTIST,
    draft.id,
    completeBody(
      record.version,
      record.content.works.map((work) => work.mediaKey),
    ),
  );
  return ctx.applicant.submit(ARTIST, draft.id, saved.version);
}

describe("contracts mirror the domain", () => {
  it("lists the same statuses, steps and work kinds", () => {
    expect([...ARTIST_APPLICATION_STATUS_VALUES]).toEqual([...ARTIST_APPLICATION_STATUSES]);
    expect([...ARTIST_APPLICATION_STEP_VALUES]).toEqual([...ARTIST_APPLICATION_STEPS]);
    expect([...ARTIST_APPLICATION_WORK_KIND_VALUES]).toEqual([...ARTIST_APPLICATION_WORK_KINDS]);
  });
});

describe("applying", () => {
  let ctx: Setup;
  beforeEach(() => {
    ctx = setup();
  });

  it("starts one draft and returns it again on a second start", async () => {
    const first = await ctx.applicant.start(ARTIST);
    const second = await ctx.applicant.start(ARTIST);
    expect(second.id).toBe(first.id);
    expect(first.status).toBe("draft");
    expect(first.reference).toMatch(/^LAX-AP-\d+$/);
    expect(ctx.store.rows.size).toBe(1);
  });

  it("reports what is missing on a new draft", async () => {
    const draft = await ctx.applicant.start(ARTIST);
    expect(draft.editable).toBe(true);
    expect(draft.blockers.map((b) => b.step)).toEqual([
      "about",
      "about",
      "about",
      "work",
      "statement",
      "agreement",
    ]);
  });

  it("tidies answers on save: web addresses, blank answers, empty links", async () => {
    const draft = await ctx.applicant.start(ARTIST);
    const record = await addWorks(ctx, draft.id, 1);
    const saved = await ctx.applicant.save(
      ARTIST,
      draft.id,
      completeBody(record.version, [record.content.works[0]?.mediaKey ?? ""]),
    );
    expect(saved.website).toBe("https://adamoreno.example/");
    expect(saved.socialLinks).toEqual(["https://instagram.com/adamoreno"]);
    expect(saved.exhibitions).toBeNull();
    expect(saved.works).toHaveLength(1);
  });

  it("removes a work when the form leaves it out", async () => {
    const draft = await ctx.applicant.start(ARTIST);
    const record = await addWorks(ctx, draft.id, 3);
    const keys = record.content.works.map((work) => work.mediaKey);
    const saved = await ctx.applicant.save(
      ARTIST,
      draft.id,
      completeBody(record.version, [keys[2] ?? "", keys[0] ?? ""]),
    );
    expect(saved.works.map((work) => work.mediaKey)).toEqual([keys[2], keys[0]]);
  });

  it("refuses a work that was not uploaded to this application", async () => {
    const draft = await ctx.applicant.start(ARTIST);
    await expect(
      ctx.applicant.save(ARTIST, draft.id, completeBody(draft.version, ["shop/other.jpg"])),
    ).rejects.toThrow("An image was not uploaded to this application");
  });

  it("refuses a save made from an older copy", async () => {
    const draft = await ctx.applicant.start(ARTIST);
    await ctx.applicant.save(ARTIST, draft.id, completeBody(draft.version, []));
    await expect(
      ctx.applicant.save(ARTIST, draft.id, completeBody(draft.version, [])),
    ).rejects.toBeInstanceOf(StaleVersionError);
  });

  it("hides another account's application", async () => {
    const draft = await ctx.applicant.start(ARTIST);
    await expect(
      ctx.applicant.save(OTHER, draft.id, completeBody(draft.version, [])),
    ).rejects.toThrow("Application not found");
    await expect(
      ctx.applicant.presignImage(OTHER, draft.id, { contentType: "image/jpeg", byteSize: 1 }),
    ).rejects.toThrow("Application not found");
  });

  it("refuses an image someone else uploaded", async () => {
    const draft = await ctx.applicant.start(ARTIST);
    ctx.store.uploads.owners.set("shop/artist-application/theirs.jpg", OTHER);
    await expect(
      ctx.applicant.confirmImage(ARTIST, draft.id, "shop/artist-application/theirs.jpg"),
    ).rejects.toThrow("Upload not found");
  });

  it("stops at twelve works", async () => {
    const draft = await ctx.applicant.start(ARTIST);
    await addWorks(ctx, draft.id, 12);
    await expect(
      ctx.applicant.presignImage(ARTIST, draft.id, { contentType: "image/jpeg", byteSize: 1 }),
    ).rejects.toBeInstanceOf(ShopDomainError);
  });

  it("refuses to send an incomplete application and names each gap", async () => {
    const draft = await ctx.applicant.start(ARTIST);
    const error = await ctx.applicant.submit(ARTIST, draft.id, draft.version).catch((e) => e);
    expect(error).toBeInstanceOf(ArtistApplicationIncompleteError);
    expect((error as ArtistApplicationIncompleteError).blockers.length).toBeGreaterThan(0);
    expect(ctx.store.rows.get(draft.id)?.status).toBe("draft");
  });

  it("sends a complete application, records it and emails a copy", async () => {
    const sent = await submittedApplication(ctx);
    expect(sent.status).toBe("submitted");
    expect(sent.editable).toBe(false);
    expect(sent.submittedAt).toBe(NOW.toISOString());
    expect(ctx.store.events.map((event) => event.action)).toEqual(["submit"]);
    expect(ctx.store.emails).toEqual([
      {
        kind: "received",
        to: "ada@example.com",
        vars: { to: "ada@example.com", reference: sent.reference, artistName: "Ada Moreno" },
      },
    ]);
  });

  it("refuses changes once sent", async () => {
    const sent = await submittedApplication(ctx);
    await expect(
      ctx.applicant.save(ARTIST, sent.id, completeBody(sent.version, [])),
    ).rejects.toThrow("can no longer be changed");
  });

  it("answers when an account is over its allowance", async () => {
    const limited = setup({ limited: "submit" });
    await expect(limited.applicant.start(ARTIST)).rejects.toMatchObject({ statusCode: 429 });
  });
});

describe("reviewing", () => {
  let ctx: Setup;
  beforeEach(() => {
    ctx = setup();
  });

  it("assigning a reviewer starts the review and is audited", async () => {
    const sent = await submittedApplication(ctx);
    const result = await ctx.review.assign({
      actorSubjectId: REVIEWER,
      applicationId: sent.id,
      expectedVersion: sent.version,
      assigneeSubject: REVIEWER,
    });
    expect(result.status).toBe("in_review");
    expect(ctx.store.audit.at(-1)).toMatchObject({
      action: "artist_application.assign",
      capability: "artist_application.review",
      targetId: sent.id,
    });
  });

  it("refuses a reviewer who cannot review applications", async () => {
    const sent = await submittedApplication(ctx);
    await expect(
      ctx.review.assign({
        actorSubjectId: REVIEWER,
        applicationId: sent.id,
        expectedVersion: sent.version,
        assigneeSubject: "subject-finance",
      }),
    ).rejects.toThrow("Choose a member of staff who can review applications");
  });

  it("asks for more information, lets the artist answer and send it back", async () => {
    const sent = await submittedApplication(ctx);
    const asked = await ctx.review.requestInformation({
      actorSubjectId: REVIEWER,
      applicationId: sent.id,
      expectedVersion: sent.version,
      message: " Could you add the frame sizes? ",
    });
    expect(asked.status).toBe("more_info_needed");
    expect(ctx.store.emails.at(-1)).toMatchObject({
      kind: "more_info",
      vars: { message: "Could you add the frame sizes?" },
    });
    const state = await ctx.applicant.getState(ARTIST);
    expect(state.application?.messageToArtist).toBe("Could you add the frame sizes?");
    expect(state.application?.editable).toBe(true);
    const answered = await ctx.applicant.submit(ARTIST, sent.id, asked.version);
    expect(answered.status).toBe("in_review");
    expect(answered.messageToArtist).toBeNull();
    // The reviewer who asked keeps it while the artist answers.
    expect(ctx.store.rows.get(sent.id)?.assigneeSubject).toBe(REVIEWER);
  });

  it("declines with a reason and holds a new application for six months", async () => {
    const sent = await submittedApplication(ctx);
    const declined = await ctx.review.decline({
      actorSubjectId: REVIEWER,
      applicationId: sent.id,
      expectedVersion: sent.version,
      reason: "Your work is strong, but our programme is full this year.",
    });
    expect(declined.status).toBe("declined");
    expect(ctx.store.emails.at(-1)).toMatchObject({
      kind: "declined",
      vars: { reapplyFrom: new Date("2027-04-28T12:00:00Z") },
    });
    const waiting = await ctx.applicant.getState(ARTIST);
    expect(waiting).toMatchObject({ next: "wait", availableFrom: "2027-04-28T12:00:00.000Z" });
    await expect(ctx.applicant.start(ARTIST)).rejects.toThrow(
      "You can apply again from 2027-04-28",
    );
    ctx.advance(new Date("2027-04-28T12:00:00Z"));
    const again = await ctx.applicant.start(ARTIST);
    expect(again.id).not.toBe(sent.id);
  });

  it("accepts: makes the profile, links the account, imports drafts, sends the welcome", async () => {
    const sent = await submittedApplication(ctx);
    const accepted = await ctx.review.accept({
      actorSubjectId: REVIEWER,
      applicationId: sent.id,
      expectedVersion: sent.version,
      artistSlug: "ada-moreno",
      importWorksAsDrafts: true,
    });
    expect(accepted).toMatchObject({ status: "accepted", importedArtworkCount: 6 });
    expect(ctx.store.artists).toEqual([
      expect.objectContaining({
        slug: "ada-moreno",
        displayName: "Ada Moreno",
        linkedSubject: ARTIST,
      }),
    ]);
    expect(ctx.store.emails.at(-1)).toMatchObject({
      kind: "welcome",
      vars: { artistSlug: "ada-moreno" },
    });
    const state = await ctx.applicant.getState(ARTIST);
    expect(state.next).toBe("accepted");
  });

  it("undoes the whole acceptance when one step is refused", async () => {
    const sent = await submittedApplication(ctx);
    ctx.store.takeSlug("ada-moreno");
    await expect(
      ctx.review.accept({
        actorSubjectId: REVIEWER,
        applicationId: sent.id,
        expectedVersion: sent.version,
        artistSlug: "ada-moreno",
        importWorksAsDrafts: false,
      }),
    ).rejects.toThrow("slug taken");
    expect(ctx.store.rows.get(sent.id)?.status).toBe("submitted");
    expect(ctx.store.artists).toEqual([]);
    expect(ctx.store.audit).toEqual([]);
  });

  it("refuses an action from a stale copy and one the table forbids", async () => {
    const sent = await submittedApplication(ctx);
    await expect(
      ctx.review.decline({
        actorSubjectId: REVIEWER,
        applicationId: sent.id,
        expectedVersion: sent.version - 1,
        reason: "No",
      }),
    ).rejects.toBeInstanceOf(StaleVersionError);
    const asked = await ctx.review.requestInformation({
      actorSubjectId: REVIEWER,
      applicationId: sent.id,
      expectedVersion: sent.version,
      message: "Which gallery shows you now?",
    });
    await expect(
      ctx.review.accept({
        actorSubjectId: REVIEWER,
        applicationId: sent.id,
        expectedVersion: asked.version,
        artistSlug: "ada-moreno",
        importWorksAsDrafts: false,
      }),
    ).rejects.toBeInstanceOf(ShopDomainError);
  });

  it("never shows staff a draft", async () => {
    const draft = await ctx.applicant.start(ARTIST);
    await expect(
      ctx.review.decline({
        actorSubjectId: REVIEWER,
        applicationId: draft.id,
        expectedVersion: draft.version,
        reason: "No",
      }),
    ).rejects.toThrow("Application not found");
  });
});
