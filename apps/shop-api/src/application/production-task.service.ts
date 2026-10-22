import {
  type AdminProductionTaskListQuery,
  type ProductionTaskStatus,
  SHOP_API_ERROR_CODES,
} from "@auction/shop-contracts";
import {
  type ShopProductionTaskStatus,
  canTransitionProductionTask,
  roleHasCapability,
} from "@auction/shop-domain";
import { ShopApiError, notFound } from "../errors/shop-api-error.js";
import { decodeCatalogueCursor, encodeCatalogueCursor } from "./catalogue-cursor.js";
import type {
  ProductionTaskFilters,
  ProductionTaskRepository,
} from "./ports/production-task.repository.js";
import type { ShopStaffMemberReader } from "./ports/staff-member.reader.js";

const DEFAULT_LIMIT = 25;

// The contract and the domain each list the statuses; a status added to one fails to compile here.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const statusListsAgree: Same<ProductionTaskStatus, ShopProductionTaskStatus> = true;
void statusListsAgree;

type UpdateCommand = {
  id: string;
  expectedVersion: number;
  status?: ProductionTaskStatus;
  assigneeSubject?: string | null;
  actorSubjectId: string;
};

export type UpdateProductionTaskResult =
  | { status: "updated"; version: number; taskStatus: ProductionTaskStatus }
  | { status: "stale"; currentVersion: number }
  | { status: "not_allowed"; currentVersion: number; message: string };

function validation(message: string): ShopApiError {
  return new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, message, 400);
}

function resolveAssignee(
  value: string | undefined,
  actorSubjectId: string,
): ProductionTaskFilters["assignee"] {
  if (value === undefined) return undefined;
  if (value === "unassigned") return { type: "unassigned" };
  return { type: "subject", subject: value === "me" ? actorSubjectId : value };
}

const spoken = (status: string) => status.replace("_", " ");

/**
 * Turns the list's request vocabulary (`me`, cursors, blank search) into repository filters, and
 * refuses writes the database could not judge: an assignee must be active staff who can work on
 * production, so a task is never parked with someone who cannot open it.
 */
export function createProductionTaskService(deps: {
  repository: ProductionTaskRepository;
  staffReader: ShopStaffMemberReader;
}) {
  const { repository, staffReader } = deps;

  return {
    async list(actorSubjectId: string, query: AdminProductionTaskListQuery) {
      const q = query.q?.trim();
      const assignee = resolveAssignee(query.assignee, actorSubjectId);
      const page = await repository.list({
        filters: {
          ...(query.status ? { status: query.status } : {}),
          ...(assignee ? { assignee } : {}),
          ...(q ? { q } : {}),
        },
        cursor: decodeCatalogueCursor(query.cursor),
        limit: query.limit ?? DEFAULT_LIMIT,
      });
      return {
        items: page.items,
        counts: page.counts,
        nextCursor: page.nextCursor ? encodeCatalogueCursor(page.nextCursor) : null,
      };
    },

    async getDetail(id: string) {
      const detail = await repository.getDetail(id);
      if (!detail) throw notFound("Production task not found");
      return detail;
    },

    async listAssignees() {
      return { items: await repository.listAssignees() };
    },

    async update(command: UpdateCommand): Promise<UpdateProductionTaskResult> {
      if (command.status === undefined && command.assigneeSubject === undefined) {
        throw validation("Nothing to change: send a status or an assignee");
      }
      if (typeof command.assigneeSubject === "string") {
        const member = await staffReader.findActiveByIdentitySubject(command.assigneeSubject);
        if (!member || !roleHasCapability(member.role, "production.write")) {
          throw validation(
            "The assignee must be an active staff member who can work on production",
          );
        }
      }
      const outcome = await repository.update({
        ...command,
        canMove: canTransitionProductionTask,
      });
      if (outcome.status === "not_found") throw notFound("Production task not found");
      if (outcome.status === "not_allowed") {
        return {
          status: "not_allowed",
          currentVersion: outcome.currentVersion,
          message: `A task that is ${spoken(outcome.from)} cannot move to ${spoken(command.status ?? outcome.from)}`,
        };
      }
      return outcome;
    },
  };
}

export type ProductionTaskService = ReturnType<typeof createProductionTaskService>;
