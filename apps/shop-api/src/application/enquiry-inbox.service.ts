import {
  type AdminEnquiryListQuery,
  ENQUIRY_LIST_DEFAULT_LIMIT,
  type EnquiryKind,
  type EnquiryStatus,
  SHOP_API_ERROR_CODES,
} from "@auction/shop-contracts";
import { roleHasCapability } from "@auction/shop-domain";
import { ShopApiError, notFound } from "../errors/shop-api-error.js";
import { decodeEnquiryInboxCursor, encodeEnquiryInboxCursor } from "./enquiry-inbox-cursor.js";
import type {
  EnquiryInboxFilters,
  EnquiryInboxRepository,
} from "./ports/enquiry-inbox.repository.js";
import type { ShopStaffMemberReader } from "./ports/staff-member.reader.js";

type UpdateCommand = {
  kind: EnquiryKind;
  id: string;
  expectedVersion: string;
  status?: EnquiryStatus;
  assigneeSubject?: string | null;
  actorSubjectId: string;
};

function validation(message: string): ShopApiError {
  return new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, message, 400);
}

function resolveAssignee(
  value: string | undefined,
  actorSubjectId: string,
): EnquiryInboxFilters["assignee"] {
  if (value === undefined) return undefined;
  if (value === "unassigned") return { type: "unassigned" };
  return { type: "subject", subject: value === "me" ? actorSubjectId : value };
}

/**
 * Turns the inbox's request vocabulary (`me`, cursors, blank search) into repository filters, and
 * refuses writes the database could not judge: an assignee must be active staff who can act on
 * enquiries, so a case is never parked with someone who cannot open it.
 */
export function createEnquiryInboxService(deps: {
  repository: EnquiryInboxRepository;
  staffReader: ShopStaffMemberReader;
}) {
  const { repository, staffReader } = deps;

  return {
    async list(actorSubjectId: string, query: AdminEnquiryListQuery) {
      const q = query.q?.trim();
      const assignee = resolveAssignee(query.assignee, actorSubjectId);
      const page = await repository.list({
        filters: {
          ...(query.kind ? { kind: query.kind } : {}),
          ...(query.topic ? { topic: query.topic } : {}),
          ...(query.status ? { status: query.status } : {}),
          ...(assignee ? { assignee } : {}),
          ...(q ? { q } : {}),
        },
        cursor: decodeEnquiryInboxCursor(query.cursor),
        limit: query.limit ?? ENQUIRY_LIST_DEFAULT_LIMIT,
      });
      return {
        items: page.items,
        counts: page.counts,
        nextCursor: page.nextCursor ? encodeEnquiryInboxCursor(page.nextCursor) : null,
      };
    },

    summary: () => repository.summary(),

    listAssignees: async () => ({ items: await repository.listAssignees() }),

    async getDetail(kind: EnquiryKind, id: string) {
      const detail = await repository.getDetail(kind, id);
      if (!detail) throw notFound("Enquiry not found");
      return detail;
    },

    async update(command: UpdateCommand) {
      if (command.status === undefined && command.assigneeSubject === undefined) {
        throw validation("Nothing to change: send a status or an assignee");
      }
      if (typeof command.assigneeSubject === "string") {
        const member = await staffReader.findActiveByIdentitySubject(command.assigneeSubject);
        if (!member || !roleHasCapability(member.role, "enquiry.write")) {
          throw validation("The assignee must be an active staff member who can handle enquiries");
        }
      }
      const outcome = await repository.update(command);
      if (outcome.status === "not_found") throw notFound("Enquiry not found");
      return outcome;
    },

    async addNote(input: { kind: EnquiryKind; id: string; body: string; authorSubjectId: string }) {
      const body = input.body.trim();
      if (!body) throw validation("A note cannot be empty");
      const note = await repository.addNote({ ...input, body });
      if (!note) throw notFound("Enquiry not found");
      return note;
    },
  };
}

export type EnquiryInboxService = ReturnType<typeof createEnquiryInboxService>;
