import type { Database } from "@auction/db";
import { legalEntity, legalEntityMember, lot, notification } from "@auction/db/schema";
import {
  NOTIFICATION_NEEDS_ACTION_TYPES,
  NOTIFICATION_NEEDS_ACTION_WHILE_LOT_OPEN,
  notificationNeedsAction,
} from "@auction/domain";
import type { UserNotification, UserNotificationListItem } from "@auction/types";
import type { InferSelectModel, SQL } from "drizzle-orm";
import { and, desc, eq, ilike, inArray, isNotNull, isNull, notInArray, or, sql } from "drizzle-orm";
import type {
  INotificationReadRepository,
  NotificationCountFilter,
  NotificationCounts,
  NotificationListFilter,
  NotificationListTab,
} from "../interfaces/notification-read.repository.js";
import { escapeLikePattern } from "../lib/like-pattern.js";
import { notificationTypesForFilter } from "../lib/notification-type-filter.js";

type Row = InferSelectModel<typeof notification>;

const WHILE_LOT_OPEN = new Set<string>(NOTIFICATION_NEEDS_ACTION_WHILE_LOT_OPEN);

/** Unread, not archived, of a type that needs action, and (for outbids) on a lot still open. */
function needsActionCondition(): SQL {
  const condition = and(
    isNull(notification.archivedAt),
    eq(notification.read, false),
    inArray(notification.type, [...NOTIFICATION_NEEDS_ACTION_TYPES]),
    or(
      notInArray(notification.type, [...NOTIFICATION_NEEDS_ACTION_WHILE_LOT_OPEN]),
      eq(lot.status, "active"),
    ),
  );
  if (!condition) throw new Error("needs_action_condition_empty");
  return condition;
}

/**
 * One person's inbox narrowed to a view, a type, an account and words. Reads `legal_entity` and
 * `lot`, so the query joins both.
 */
function inboxCondition(
  userId: string,
  filter: Omit<NotificationListFilter, "limit" | "offset">,
): SQL | undefined {
  const parts: SQL[] = [eq(notification.userId, userId)];
  if (filter.tab === "archived") {
    parts.push(isNotNull(notification.archivedAt));
  } else if (filter.tab === "unread") {
    parts.push(isNull(notification.archivedAt));
    parts.push(eq(notification.read, false));
  } else if (filter.tab === "needs_action") {
    parts.push(needsActionCondition());
  } else {
    parts.push(isNull(notification.archivedAt));
  }
  if (filter.type) {
    parts.push(inArray(notification.type, [...notificationTypesForFilter(filter.type)]));
  }
  if (filter.account?.kind === "personal") {
    const personal = or(isNull(notification.legalEntityId), eq(legalEntity.kind, "individual"));
    if (personal) parts.push(personal);
  } else if (filter.account?.kind === "entity") {
    parts.push(eq(notification.legalEntityId, filter.account.legalEntityId));
  }
  const query = filter.query?.trim();
  if (query) {
    const contains = `%${escapeLikePattern(query)}%`;
    const matches = or(ilike(notification.title, contains), ilike(notification.message, contains));
    if (matches) parts.push(matches);
  }
  return and(...parts);
}

function mapRow(row: Row): UserNotification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    message: row.message,
    lotId: row.lotId,
    submissionId: row.submissionId,
    legalEntityId: row.legalEntityId,
    read: row.read,
    archivedAt: row.archivedAt ?? null,
    createdAt: row.createdAt,
  };
}

export class DrizzleNotificationReadRepository implements INotificationReadRepository {
  constructor(private readonly db: Database) {}

  async findByUser(userId: string, limit: number): Promise<UserNotification[]> {
    const rows = await this.db
      .select()
      .from(notification)
      .where(and(eq(notification.userId, userId), isNull(notification.archivedAt)))
      .orderBy(desc(notification.createdAt))
      .limit(limit);
    return rows.map(mapRow);
  }

  async countByUser(userId: string, filter: NotificationCountFilter): Promise<NotificationCounts> {
    const count = async (tab: NotificationListTab) => {
      const [row] = await this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(notification)
        .leftJoin(legalEntity, eq(legalEntity.id, notification.legalEntityId))
        .leftJoin(lot, eq(lot.id, notification.lotId))
        .where(inboxCondition(userId, { ...filter, tab }));
      return row?.n ?? 0;
    };
    const [needsAction, unread] = await Promise.all([count("needs_action"), count("unread")]);
    return { needsAction, unread };
  }

  async findByUserFiltered(
    userId: string,
    filter: NotificationListFilter,
  ): Promise<UserNotificationListItem[]> {
    const rows = await this.db
      .select({
        row: notification,
        entityKind: legalEntity.kind,
        entityName: legalEntity.displayName,
        membershipId: legalEntityMember.id,
        lotStatus: lot.status,
      })
      .from(notification)
      .leftJoin(legalEntity, eq(legalEntity.id, notification.legalEntityId))
      .leftJoin(
        legalEntityMember,
        and(
          eq(legalEntityMember.legalEntityId, notification.legalEntityId),
          eq(legalEntityMember.userId, userId),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
        ),
      )
      .leftJoin(lot, eq(lot.id, notification.lotId))
      .where(inboxCondition(userId, filter))
      .orderBy(desc(notification.createdAt))
      .limit(filter.limit)
      .offset(filter.offset);
    return rows.map(({ row, entityKind, entityName, membershipId, lotStatus }) => ({
      ...mapRow(row),
      account:
        row.legalEntityId && entityKind && entityName
          ? {
              legalEntityId: row.legalEntityId,
              kind: entityKind === "individual" ? "personal" : "organisation",
              displayName: entityName,
              canSwitch: membershipId != null,
            }
          : null,
      needsAction:
        notificationNeedsAction(row.type) &&
        !row.read &&
        row.archivedAt == null &&
        (!WHILE_LOT_OPEN.has(row.type) || lotStatus === "active"),
    }));
  }

  async markRead(userId: string, notificationId: string): Promise<boolean> {
    const result = await this.db
      .update(notification)
      .set({ read: true })
      .where(and(eq(notification.id, notificationId), eq(notification.userId, userId)))
      .returning({ id: notification.id });
    return result.length > 0;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.db
      .update(notification)
      .set({ read: true })
      .where(
        and(
          eq(notification.userId, userId),
          eq(notification.read, false),
          isNull(notification.archivedAt),
        ),
      )
      .returning({ id: notification.id });
    return result.length;
  }

  async markManyRead(userId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.db
      .update(notification)
      .set({ read: true })
      .where(
        and(
          eq(notification.userId, userId),
          inArray(notification.id, ids),
          isNull(notification.archivedAt),
        ),
      )
      .returning({ id: notification.id });
    return result.length;
  }

  async archive(userId: string, notificationId: string): Promise<boolean> {
    const result = await this.db
      .update(notification)
      .set({ archivedAt: new Date() })
      .where(and(eq(notification.id, notificationId), eq(notification.userId, userId)))
      .returning({ id: notification.id });
    return result.length > 0;
  }
}
