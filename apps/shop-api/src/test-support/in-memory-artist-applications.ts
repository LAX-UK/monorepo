import type { ArtistApplicationContent } from "@auction/shop-domain";
import type {
  ApplicantImageUploads,
  ArtistApplicationRecord,
  ArtistApplicationTx,
  ArtistApplicationUnitOfWork,
} from "../application/artist-applications/artist-application.ports.js";
import type { ShopAdminAuditRecord } from "../application/ports/shop-admin-audit.writer.js";

const EMPTY_CONTENT: ArtistApplicationContent = {
  artistName: null,
  location: null,
  website: null,
  socialLinks: [],
  shortBio: null,
  statement: null,
  representation: null,
  exhibitions: null,
  works: [],
  consentToContact: false,
};

export type RecordedEmail = { kind: string; to: string; vars: Record<string, unknown> };

/**
 * Applications in memory, with every port the services use. A transaction applies its writes to
 * a copy and keeps them only when it finishes, so a thrown refusal leaves nothing behind, as a
 * rolled-back database transaction would.
 */
export function createInMemoryArtistApplications(
  options: { emails?: Record<string, string> } = {},
) {
  let rows = new Map<string, ArtistApplicationRecord>();
  let events: Array<{
    applicationId: string;
    action: string;
    actorSubjectId: string;
    message: string | null;
  }> = [];
  let audit: ShopAdminAuditRecord[] = [];
  let emails: RecordedEmail[] = [];
  let artists: Array<{
    artistId: string;
    slug: string;
    displayName: string;
    linkedSubject: string | null;
  }> = [];
  let importedWorks = 0;
  let sequence = 10001;
  let idCounter = 0;
  const takenSlugs = new Set<string>();

  const nextId = () => {
    idCounter += 1;
    return `00000000-0000-4000-8000-${String(idCounter).padStart(12, "0")}`;
  };

  function clone(record: ArtistApplicationRecord): ArtistApplicationRecord {
    return { ...record, content: { ...record.content, works: [...record.content.works] } };
  }

  const uow: ArtistApplicationUnitOfWork = {
    async run(fn) {
      const draft = new Map([...rows].map(([id, row]) => [id, clone(row)]));
      const draftEvents = [...events];
      const draftAudit = [...audit];
      const draftEmails = [...emails];
      const draftArtists = [...artists];
      let draftImported = importedWorks;
      const touch = (id: string, change: Partial<ArtistApplicationRecord>) => {
        const row = draft.get(id);
        if (!row) throw new Error(`no application ${id}`);
        draft.set(id, { ...row, ...change, version: row.version + 1, updatedAt: new Date() });
      };
      const tx: ArtistApplicationTx = {
        applications: {
          async latestForApplicant(subject) {
            const mine = [...draft.values()].filter((row) => row.applicantSubjectId === subject);
            return mine.at(-1) ?? null;
          },
          async lock(id) {
            return draft.get(id) ?? null;
          },
          async insertDraft(subject) {
            const id = nextId();
            const row: ArtistApplicationRecord = {
              id,
              reference: `LAX-AP-${sequence++}`,
              applicantSubjectId: subject,
              status: "draft",
              content: EMPTY_CONTENT,
              contactEmail: null,
              assigneeSubject: null,
              messageToArtist: null,
              artistId: null,
              submittedAt: null,
              decidedAt: null,
              version: 1,
              updatedAt: new Date(),
              images: new Map(),
            };
            draft.set(id, row);
            return row;
          },
          async saveContent(id, content) {
            touch(id, { content });
          },
          async appendWork(id, mediaKey) {
            const row = draft.get(id);
            if (!row) throw new Error("missing");
            touch(id, {
              content: {
                ...row.content,
                works: [
                  ...row.content.works,
                  { mediaKey, title: null, year: null, medium: null, size: null, kind: null },
                ],
              },
            });
          },
          async setState(id, patch) {
            const { status, ...rest } = patch;
            const change: Partial<ArtistApplicationRecord> = { status };
            for (const [key, value] of Object.entries(rest)) {
              if (value !== undefined) Object.assign(change, { [key]: value });
            }
            touch(id, change);
          },
          async appendEvent(event) {
            draftEvents.push({
              applicationId: event.applicationId,
              action: event.action,
              actorSubjectId: event.actorSubjectId,
              message: event.message ?? null,
            });
          },
        },
        applicants: {
          async contactFor(subject) {
            return { email: options.emails?.[subject] ?? null, name: null };
          },
        },
        onboarding: {
          async createArtistProfile(input) {
            if (takenSlugs.has(input.slug)) throw new Error("slug taken");
            const artistId = nextId();
            draftArtists.push({
              artistId,
              slug: input.slug,
              displayName: input.displayName,
              linkedSubject: null,
            });
            return { artistId, slug: input.slug };
          },
          async grantPortalAccess(input) {
            const artist = draftArtists.find((one) => one.artistId === input.artistId);
            if (!artist) throw new Error("missing artist");
            artist.linkedSubject = input.identitySubjectId;
          },
          async importDraftArtworks(input) {
            draftImported += input.works.length;
            return input.works.length;
          },
        },
        notifier: {
          async received(input) {
            draftEmails.push({ kind: "received", to: input.to, vars: input });
          },
          async moreInformationNeeded(input) {
            draftEmails.push({ kind: "more_info", to: input.to, vars: input });
          },
          async declined(input) {
            draftEmails.push({ kind: "declined", to: input.to, vars: input });
          },
          async welcome(input) {
            draftEmails.push({ kind: "welcome", to: input.to, vars: input });
          },
        },
        audit: {
          async append(record) {
            draftAudit.push(record);
          },
        },
      };
      const result = await fn(tx);
      rows = draft;
      events = draftEvents;
      audit = draftAudit;
      emails = draftEmails;
      artists = draftArtists;
      importedWorks = draftImported;
      return result;
    },
  };

  const uploads: ApplicantImageUploads & { owners: Map<string, string>; rejected: Set<string> } = {
    owners: new Map(),
    rejected: new Set(),
    async presign(input) {
      const key = `shop/artist-application/${nextId()}.jpg`;
      uploads.owners.set(key, input.subjectId);
      return { key, uploadUrl: `https://uploads.example/${key}`, requiredHeaders: {} };
    },
    async confirm(key) {
      if (uploads.rejected.has(key)) throw new Error("not an image");
    },
    async ownerOf(key) {
      const subjectId = uploads.owners.get(key);
      return subjectId ? { subjectId, applicationImage: true } : null;
    },
  };

  return {
    uow,
    uploads,
    takeSlug: (slug: string) => takenSlugs.add(slug),
    get rows() {
      return rows;
    },
    get events() {
      return events;
    },
    get audit() {
      return audit;
    },
    get emails() {
      return emails;
    },
    get artists() {
      return artists;
    },
    get importedWorks() {
      return importedWorks;
    },
  };
}
