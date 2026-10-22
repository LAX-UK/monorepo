import type { Database } from "@auction/db";
import {
  shopAdminAudit,
  shopArtwork,
  shopEdition,
  shopOrderLine,
  shopProductionTask,
  shopStaffMember,
  shopUserProfile,
} from "@auction/db/schema";
import type {
  AdminProductionTaskHistoryEntry,
  ProductionTaskStaff,
  ProductionTaskStatus,
} from "@auction/shop-contracts";
import { roleHasCapability } from "@auction/shop-domain";
import { type SQL, and, asc, count, eq, isNull, or, sql } from "drizzle-orm";
import type {
  ProductionTaskFilters,
  ProductionTaskRepository,
} from "../application/ports/production-task.repository.js";
import { keysetBeforeCreatedAtId, orderByMsTimestampIdDesc } from "./admin-created-at-keyset.js";
import { containsPattern } from "./drizzle-editorial-search.reader.js";
import { insertShopAdminAudit } from "./shop-admin-audit.js";

/** The `target_type` of every audit row written for a production task. */
export const PRODUCTION_TASK_AUDIT_TARGET = "shop_production_task";

const taskColumns = {
  task: shopProductionTask,
  orderId: shopOrderLine.orderId,
  artworkTitle: shopArtwork.title,
  editionNumber: shopEdition.editionNumber,
  assigneeName: shopUserProfile.name,
  assigneeEmail: shopUserProfile.email,
  assigneeRole: shopStaffMember.role,
};

function selectTasks(db: Database) {
  return db
    .select(taskColumns)
    .from(shopProductionTask)
    .innerJoin(shopOrderLine, eq(shopOrderLine.id, shopProductionTask.orderLineId))
    .leftJoin(shopEdition, eq(shopEdition.id, shopProductionTask.editionId))
    .leftJoin(shopArtwork, eq(shopArtwork.id, shopEdition.artworkId))
    .leftJoin(
      shopUserProfile,
      eq(shopUserProfile.identitySubjectId, shopProductionTask.assignedToSubjectId),
    )
    .leftJoin(
      shopStaffMember,
      eq(shopStaffMember.identitySubjectId, shopProductionTask.assignedToSubjectId),
    );
}

type TaskRow = Awaited<ReturnType<ReturnType<typeof selectTasks>["limit"]>>[number];

function staffRef(
  subject: string,
  profile: { name: string | null; email: string | null; role: string | null },
): ProductionTaskStaff {
  return {
    subject,
    label: profile.name?.trim() || profile.email?.trim() || null,
    role: profile.role,
  };
}

function toListItem(row: TaskRow) {
  const { task } = row;
  return {
    taskId: task.id,
    orderId: row.orderId,
    orderLineId: task.orderLineId,
    editionId: task.editionId,
    artworkTitle: row.artworkTitle,
    editionNumber: row.editionNumber,
    status: task.status,
    assignee: task.assignedToSubjectId
      ? staffRef(task.assignedToSubjectId, {
          name: row.assigneeName,
          email: row.assigneeEmail,
          role: row.assigneeRole,
        })
      : null,
    version: task.version,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

/** Every filter except `status`, which the list applies itself so the counts can ignore it. */
function filterConditions(filters: ProductionTaskFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.assignee?.type === "unassigned") {
    conditions.push(isNull(shopProductionTask.assignedToSubjectId));
  }
  if (filters.assignee?.type === "subject") {
    conditions.push(eq(shopProductionTask.assignedToSubjectId, filters.assignee.subject));
  }
  const q = filters.q?.trim().replace(/^#/, "");
  if (q) {
    const contains = containsPattern(q);
    // Ids match from the start, which is how staff quote them; the leading wildcard is dropped.
    const idPrefix = contains.slice(1);
    const search = or(
      sql`${shopArtwork.title} ILIKE ${contains}`,
      sql`${shopProductionTask.id}::text ILIKE ${idPrefix}`,
      sql`${shopOrderLine.orderId}::text ILIKE ${idPrefix}`,
    );
    if (search) conditions.push(search);
  }
  return conditions;
}

type AuditSnapshot = { status?: string; assigneeSubject?: string | null };

function parseSnapshot(value: string | null): AuditSnapshot | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as AuditSnapshot) : null;
  } catch {
    return null;
  }
}

export function createDrizzleProductionTaskRepository(db: Database): ProductionTaskRepository {
  /** Names and roles for a set of staff subjects, so history never shows a bare identifier. */
  async function resolveStaff(subjects: string[]): Promise<Map<string, ProductionTaskStaff>> {
    const unique = [...new Set(subjects)];
    if (unique.length === 0) return new Map();
    const rows = await db
      .select({
        subject: shopStaffMember.identitySubjectId,
        role: shopStaffMember.role,
        name: shopUserProfile.name,
        email: shopUserProfile.email,
      })
      .from(shopStaffMember)
      .leftJoin(
        shopUserProfile,
        eq(shopUserProfile.identitySubjectId, shopStaffMember.identitySubjectId),
      )
      .where(or(...unique.map((subject) => eq(shopStaffMember.identitySubjectId, subject))) as SQL);
    const found = new Map(
      rows.map((row) => [
        row.subject,
        staffRef(row.subject, { name: row.name, email: row.email, role: row.role }),
      ]),
    );
    // Someone who has left the team still appears in old history.
    for (const subject of unique) {
      if (!found.has(subject)) {
        found.set(subject, { subject, label: null, role: null });
      }
    }
    return found;
  }

  return {
    async list(input) {
      const filters = filterConditions(input.filters);
      const [rows, countRows] = await Promise.all([
        selectTasks(db)
          .where(
            and(
              ...filters,
              input.filters.status
                ? eq(shopProductionTask.status, input.filters.status)
                : undefined,
              input.cursor
                ? keysetBeforeCreatedAtId(
                    shopProductionTask.createdAt,
                    shopProductionTask.id,
                    input.cursor,
                  )
                : undefined,
            ),
          )
          .orderBy(...orderByMsTimestampIdDesc(shopProductionTask.createdAt, shopProductionTask.id))
          .limit(input.limit + 1),
        db
          .select({ status: shopProductionTask.status, total: count() })
          .from(shopProductionTask)
          .innerJoin(shopOrderLine, eq(shopOrderLine.id, shopProductionTask.orderLineId))
          .leftJoin(shopEdition, eq(shopEdition.id, shopProductionTask.editionId))
          .leftJoin(shopArtwork, eq(shopArtwork.id, shopEdition.artworkId))
          .where(and(...filters))
          .groupBy(shopProductionTask.status),
      ]);
      const page = rows.slice(0, input.limit);
      const last = page.at(-1);
      return {
        items: page.map(toListItem),
        nextCursor:
          rows.length > input.limit && last
            ? { createdAt: last.task.createdAt, id: last.task.id }
            : null,
        counts: Object.fromEntries(countRows.map((row) => [row.status, row.total])),
      };
    },

    async getDetail(id) {
      const [row] = await selectTasks(db).where(eq(shopProductionTask.id, id)).limit(1);
      if (!row) return null;

      const audit = await db
        .select()
        .from(shopAdminAudit)
        .where(
          and(
            eq(shopAdminAudit.targetType, PRODUCTION_TASK_AUDIT_TARGET),
            eq(shopAdminAudit.targetId, id),
          ),
        )
        .orderBy(asc(shopAdminAudit.createdAt), asc(shopAdminAudit.id));
      const parsed = audit.map((entry) => ({
        entry,
        before: parseSnapshot(entry.beforeJson),
        after: parseSnapshot(entry.afterJson),
      }));
      const people = await resolveStaff(
        parsed.flatMap(({ entry, before, after }) => [
          entry.actorSubjectId,
          ...[before?.assigneeSubject, after?.assigneeSubject].filter(
            (subject): subject is string => typeof subject === "string",
          ),
        ]),
      );
      const person = (subject: string | null | undefined) =>
        subject ? (people.get(subject) ?? null) : null;

      const history: AdminProductionTaskHistoryEntry[] = parsed.map(({ entry, before, after }) => {
        const statusChanged = before?.status !== undefined && before.status !== after?.status;
        const assigneeChanged =
          before !== null &&
          after !== null &&
          (before.assigneeSubject ?? null) !== (after.assigneeSubject ?? null);
        return {
          id: entry.id,
          at: entry.createdAt.toISOString(),
          actor: person(entry.actorSubjectId) ?? {
            subject: entry.actorSubjectId,
            label: null,
            role: null,
          },
          kind: entry.action === "create_production_task" ? "created" : "updated",
          status:
            statusChanged && after?.status
              ? {
                  from: before?.status as ProductionTaskStatus,
                  to: after.status as ProductionTaskStatus,
                }
              : null,
          assignee: assigneeChanged
            ? { from: person(before?.assigneeSubject), to: person(after?.assigneeSubject) }
            : null,
        };
      });

      return { ...toListItem(row), history };
    },

    async update(input) {
      return db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(shopProductionTask)
          .where(eq(shopProductionTask.id, input.id))
          .for("update")
          .limit(1);
        if (!current) return { status: "not_found" };
        if (current.version !== input.expectedVersion) {
          return { status: "stale", currentVersion: current.version };
        }

        const nextStatus = input.status ?? current.status;
        const nextAssignee =
          input.assigneeSubject === undefined ? current.assignedToSubjectId : input.assigneeSubject;
        const statusChanged = nextStatus !== current.status;
        if (statusChanged && !input.canMove(current.status, nextStatus)) {
          return { status: "not_allowed", currentVersion: current.version, from: current.status };
        }
        if (!statusChanged && nextAssignee === current.assignedToSubjectId) {
          return { status: "updated", version: current.version, taskStatus: current.status };
        }

        const [updated] = await tx
          .update(shopProductionTask)
          .set({
            status: nextStatus,
            assignedToSubjectId: nextAssignee,
            version: current.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(shopProductionTask.id, input.id))
          .returning({ version: shopProductionTask.version });
        if (!updated) throw new Error("Production task vanished while locked");

        await insertShopAdminAudit(tx as Database, {
          actorSubjectId: input.actorSubjectId,
          capability: "production.write",
          action: "production.update_task",
          targetType: PRODUCTION_TASK_AUDIT_TARGET,
          targetId: input.id,
          beforeJson: { status: current.status, assigneeSubject: current.assignedToSubjectId },
          afterJson: { status: nextStatus, assigneeSubject: nextAssignee },
        });
        return { status: "updated", version: updated.version, taskStatus: nextStatus };
      });
    },

    async listAssignees() {
      const staff = await db
        .select({
          subject: shopStaffMember.identitySubjectId,
          role: shopStaffMember.role,
          name: shopUserProfile.name,
          email: shopUserProfile.email,
        })
        .from(shopStaffMember)
        .leftJoin(
          shopUserProfile,
          eq(shopUserProfile.identitySubjectId, shopStaffMember.identitySubjectId),
        )
        .where(isNull(shopStaffMember.disabledAt));
      return staff
        .filter((member) => roleHasCapability(member.role, "production.write"))
        .map((member) =>
          staffRef(member.subject, { name: member.name, email: member.email, role: member.role }),
        )
        .sort((a, b) => (a.label ?? a.subject).localeCompare(b.label ?? b.subject, "en-GB"));
    },
  };
}
