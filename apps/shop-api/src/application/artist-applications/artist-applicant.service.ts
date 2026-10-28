import {
  type MyArtistApplication,
  type MyArtistApplicationState,
  SHOP_API_ERROR_CODES,
  type SaveArtistApplicationBody,
} from "@auction/shop-contracts";
import {
  ARTIST_APPLICATION_LIMITS,
  type ArtistApplicationContent,
  ShopDomainError,
  artistApplicationSubmitBlockers,
  assertArtistApplicationContentWithinLimits,
  decideArtistApplicationStart,
  isArtistApplicationEditable,
  normaliseArtistApplicationUrl,
  transitionArtistApplication,
} from "@auction/shop-domain";
import { ArtistApplicationIncompleteError } from "../../errors/artist-application-incomplete-error.js";
import { ShopApiError, notFound } from "../../errors/shop-api-error.js";
import { StaleVersionError } from "../../errors/stale-version-error.js";
import type {
  ArtistApplicationRateKind,
  ArtistApplicationRateLimiters,
} from "./artist-application-rate-limits.js";
import type {
  ApplicantImageUploads,
  ArtistApplicationRecord,
  ArtistApplicationTx,
  ArtistApplicationUnitOfWork,
  Clock,
} from "./artist-application.ports.js";
import {
  presentMyArtistApplication,
  presentMyArtistApplicationState,
} from "./my-artist-application.view.js";

type Deps = {
  uow: ArtistApplicationUnitOfWork;
  uploads: ApplicantImageUploads;
  rateLimiters: ArtistApplicationRateLimiters;
  clock: Clock;
  /** Logs a limiter outage; applying carries on, as a lost application costs more. */
  onRateLimitUnavailable?: (error: unknown) => void;
};

const LIMIT_MESSAGES: Record<ArtistApplicationRateKind, string> = {
  upload: "You have uploaded a lot of images in the last hour. Try again later.",
  save: "Your application was saved many times in the last hour. Try again later.",
  submit: "You have started or sent several applications today. Try again tomorrow.",
};

function text(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function url(value: string | null): string | null {
  const trimmed = text(value);
  if (!trimmed) return null;
  return normaliseArtistApplicationUrl(trimmed) ?? trimmed;
}

/**
 * Turns what the form sent into application content. Web addresses are tidied (a missing
 * `https://` is added) and blank answers become null; the limits check then refuses anything
 * that is still not a web address. Only images already uploaded to this application may be kept.
 */
function contentFromBody(
  body: SaveArtistApplicationBody,
  current: ArtistApplicationRecord,
): ArtistApplicationContent {
  const uploaded = new Set(current.content.works.map((work) => work.mediaKey));
  if (body.works.some((work) => !uploaded.has(work.mediaKey))) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.VALIDATION,
      "An image was not uploaded to this application; upload it again",
      400,
    );
  }
  return {
    artistName: text(body.artistName),
    location: text(body.location),
    website: url(body.website),
    socialLinks: body.socialLinks.map((link) => url(link)).filter((link) => link !== null),
    shortBio: text(body.shortBio),
    statement: text(body.statement),
    representation: text(body.representation),
    exhibitions: text(body.exhibitions),
    consentToContact: body.consentToContact,
    works: body.works.map((work) => ({
      mediaKey: work.mediaKey,
      title: text(work.title),
      year: work.year,
      medium: text(work.medium),
      size: text(work.size),
      kind: work.kind,
    })),
  };
}

/**
 * The applicant's side: start an application, save it step by step, upload images, and send
 * it. Every call acts on the caller's own application only; someone else's is reported as not
 * found, so its existence is never confirmed.
 */
export function createArtistApplicantService(deps: Deps) {
  const { uow, uploads, rateLimiters, clock } = deps;

  async function consume(kind: ArtistApplicationRateKind, subject: string): Promise<void> {
    let decision: Awaited<ReturnType<ArtistApplicationRateLimiters[typeof kind]["consume"]>>;
    try {
      decision = await rateLimiters[kind].consume({ clientIp: null, senderKey: subject });
    } catch (error) {
      deps.onRateLimitUnavailable?.(error);
      return;
    }
    if (!decision.allowed) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.RATE_LIMITED, LIMIT_MESSAGES[kind], 429);
    }
  }

  async function lockOwn(
    tx: ArtistApplicationTx,
    subject: string,
    id: string,
  ): Promise<ArtistApplicationRecord> {
    const record = await tx.applications.lock(id);
    if (!record || record.applicantSubjectId !== subject) throw notFound("Application not found");
    return record;
  }

  function assertEditable(record: ArtistApplicationRecord): void {
    if (!isArtistApplicationEditable(record.status)) {
      throw new ShopDomainError("This application has been sent and can no longer be changed");
    }
  }

  function assertVersion(record: ArtistApplicationRecord, expectedVersion: number): void {
    if (record.version !== expectedVersion) {
      throw new StaleVersionError("Your application", String(record.version));
    }
  }

  async function reread(tx: ArtistApplicationTx, id: string): Promise<MyArtistApplication> {
    const record = await tx.applications.lock(id);
    if (!record) throw notFound("Application not found");
    return presentMyArtistApplication(record, clock.now());
  }

  return {
    /** Whether the person has ever applied, for the seller tools LAX Account offers them. */
    async hasApplication(subject: string): Promise<boolean> {
      return (await uow.run((tx) => tx.applications.latestForApplicant(subject))) !== null;
    },

    async getState(subject: string): Promise<MyArtistApplicationState> {
      return uow.run(async (tx) => {
        const latest = await tx.applications.latestForApplicant(subject);
        const now = clock.now();
        return presentMyArtistApplicationState(
          latest,
          decideArtistApplicationStart(latest, now),
          now,
        );
      });
    },

    /** Starts a draft, or returns the open one: pressing "Apply" twice never makes two. */
    async start(subject: string): Promise<MyArtistApplication> {
      const existing = await uow.run((tx) => tx.applications.latestForApplicant(subject));
      const decision = decideArtistApplicationStart(existing, clock.now());
      if (decision.kind === "continue" && existing) {
        return presentMyArtistApplication(existing, clock.now());
      }
      if (decision.kind === "accepted") {
        throw new ShopDomainError("You are already a gallery artist; use the artist portal");
      }
      if (decision.kind === "wait") {
        throw new ShopDomainError(
          `You can apply again from ${decision.availableFrom.toISOString().slice(0, 10)}`,
        );
      }
      await consume("submit", subject);
      return uow.run(async (tx) => {
        const created = await tx.applications.insertDraft(subject);
        return presentMyArtistApplication(created, clock.now());
      });
    },

    async save(
      subject: string,
      id: string,
      body: SaveArtistApplicationBody,
    ): Promise<MyArtistApplication> {
      await consume("save", subject);
      return uow.run(async (tx) => {
        const record = await lockOwn(tx, subject, id);
        assertEditable(record);
        assertVersion(record, body.expectedVersion);
        const content = contentFromBody(body, record);
        assertArtistApplicationContentWithinLimits(content);
        await tx.applications.saveContent(id, content);
        return reread(tx, id);
      });
    },

    async presignImage(
      subject: string,
      id: string,
      input: { contentType: string; byteSize: number },
    ) {
      await consume("upload", subject);
      await uow.run(async (tx) => {
        const record = await lockOwn(tx, subject, id);
        assertEditable(record);
        if (record.content.works.length >= ARTIST_APPLICATION_LIMITS.maxWorks) {
          throw new ShopDomainError(
            `An application holds up to ${ARTIST_APPLICATION_LIMITS.maxWorks} works; remove one to add another`,
          );
        }
      });
      return uploads.presign({ ...input, subjectId: subject });
    },

    /** Checks the uploaded image, then adds it as the application's next work. */
    async confirmImage(subject: string, id: string, key: string): Promise<MyArtistApplication> {
      const owner = await uploads.ownerOf(key);
      if (!owner || owner.subjectId !== subject || !owner.applicationImage) {
        throw notFound("Upload not found");
      }
      await uploads.confirm(key);
      return uow.run(async (tx) => {
        const record = await lockOwn(tx, subject, id);
        assertEditable(record);
        if (record.content.works.some((work) => work.mediaKey === key)) return reread(tx, id);
        if (record.content.works.length >= ARTIST_APPLICATION_LIMITS.maxWorks) {
          throw new ShopDomainError(
            `An application holds up to ${ARTIST_APPLICATION_LIMITS.maxWorks} works; remove one to add another`,
          );
        }
        await tx.applications.appendWork(id, key);
        return reread(tx, id);
      });
    },

    /** Sends a draft, or sends back an application the gallery asked a question about. */
    async submit(
      subject: string,
      id: string,
      expectedVersion: number,
    ): Promise<MyArtistApplication> {
      await consume("submit", subject);
      return uow.run(async (tx) => {
        const record = await lockOwn(tx, subject, id);
        assertVersion(record, expectedVersion);
        const action = record.status === "draft" ? "submit" : "resubmit";
        const status = transitionArtistApplication(action, record.status);
        const now = clock.now();
        const blockers = artistApplicationSubmitBlockers(record.content, now);
        if (blockers.length > 0) throw new ArtistApplicationIncompleteError(blockers);
        const contact = await tx.applicants.contactFor(subject);
        await tx.applications.setState(id, {
          status,
          contactEmail: contact.email,
          ...(action === "submit" ? { submittedAt: now } : { messageToArtist: null }),
        });
        await tx.applications.appendEvent({ applicationId: id, action, actorSubjectId: subject });
        if (action === "submit" && contact.email) {
          await tx.notifier.received({
            to: contact.email,
            reference: record.reference,
            artistName: record.content.artistName ?? "",
          });
        }
        return reread(tx, id);
      });
    },
  };
}

export type ArtistApplicantService = ReturnType<typeof createArtistApplicantService>;
