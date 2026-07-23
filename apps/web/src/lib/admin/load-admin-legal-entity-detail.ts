import { buildLegalEntityHealthVM } from "@/lib/admin/legal-entity-health";
import {
  getAdminDomainEventsForAggregate,
  getAdminLegalEntityById,
  getAdminLegalEntityDocuments,
  getAdminUserById,
} from "@/lib/data/http/admin.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import {
  AUDIT_DOMAIN_EVENTS_ACCESS,
  LEGAL_ENTITY_BROWSE_ACCESS,
  USERS_DIRECTORY_ACCESS,
} from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";
import { notFound } from "next/navigation";
import { cache } from "react";

export type AdminLegalEntityDetailBundle = {
  entity: NonNullable<Awaited<ReturnType<typeof getAdminLegalEntityById>>>;
  creator: { id: string; name: string; email: string } | null;
  documents: Awaited<ReturnType<typeof getAdminLegalEntityDocuments>>;
  activityEvents: Awaited<ReturnType<typeof getAdminDomainEventsForAggregate>>;
  health: ReturnType<typeof buildLegalEntityHealthVM>;
  canViewOwner: boolean;
  canViewDocuments: boolean;
  canViewActivity: boolean;
};

export const loadAdminLegalEntityDetail = cache(
  async (entityId: string): Promise<AdminLegalEntityDetailBundle> => {
    const sessionUser = await getServerSessionUser();
    const actorRole = (sessionUser?.role ?? "client") as UserRole;
    const actorStaff = sessionUser?.staffRole ?? null;
    const canBrowse =
      sessionUser != null && userHasAccessTo(actorRole, actorStaff, LEGAL_ENTITY_BROWSE_ACCESS);
    const canViewOwner =
      sessionUser != null && userHasAccessTo(actorRole, actorStaff, USERS_DIRECTORY_ACCESS);
    const canViewDocuments = canBrowse;
    const canViewActivity =
      sessionUser != null && userHasAccessTo(actorRole, actorStaff, AUDIT_DOMAIN_EVENTS_ACCESS);

    let entity: Awaited<ReturnType<typeof getAdminLegalEntityById>> = null;
    try {
      entity = await getAdminLegalEntityById(entityId);
    } catch {
      notFound();
    }
    if (!entity) {
      notFound();
    }

    const [creatorUser, documents, activityEvents] = await Promise.all([
      canViewOwner
        ? getAdminUserById(entity.createdByUserId).catch(() => null)
        : Promise.resolve(null),
      canViewDocuments
        ? getAdminLegalEntityDocuments(entityId).catch(() => [])
        : Promise.resolve([]),
      canViewActivity
        ? getAdminDomainEventsForAggregate({
            aggregateType: "legal_entity",
            aggregateId: entityId,
            limit: 20,
          }).catch(() => [])
        : Promise.resolve([]),
    ]);

    const creator = creatorUser
      ? { id: creatorUser.id, name: creatorUser.name, email: creatorUser.email }
      : null;

    return {
      entity,
      creator,
      documents,
      activityEvents,
      health: buildLegalEntityHealthVM(entity),
      canViewOwner,
      canViewDocuments,
      canViewActivity,
    };
  },
);
