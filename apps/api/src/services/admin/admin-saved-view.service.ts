import type {
  AdminSavedViewRecord,
  IAdminSavedViewRepository,
} from "@auction/persistence/interfaces";
import {
  type CapabilityRequirement,
  FINANCE_ACCESS,
  LOTS_ACCESS,
  SUBMISSIONS_ACCESS,
  USERS_DIRECTORY_ACCESS,
  type UserRole,
  normalizeUserStaffRole,
  userHasAccessTo,
} from "@auction/types";
import {
  ADMIN_SAVED_VIEWS_PER_LIST_MAX,
  type AdminSavedViewDto,
  type AdminSavedViewListKey,
} from "@auction/validators";
import { type Result, err, ok } from "neverthrow";

export type SavedViewActor = {
  userId: string;
  role: string;
  staffRole: string | null | undefined;
};

export type SavedViewError = {
  status: 403 | 404 | 409;
  message: string;
  /** Machine-readable reason the admin can act on. */
  code?: "duplicate_label" | "limit_reached" | "order_changed";
};

/**
 * Who may keep views for each list: the people who may open that list. A view is only a saved
 * set of filters, so it grants nothing, but offering to save one on a list a person cannot see
 * would be a dead end.
 */
const LIST_ACCESS: Record<AdminSavedViewListKey, CapabilityRequirement> = {
  "bid-admin.lots": LOTS_ACCESS,
  "bid-admin.clients": USERS_DIRECTORY_ACCESS,
  "bid-admin.submissions": SUBMISSIONS_ACCESS,
  "bid-admin.payments": FINANCE_ACCESS,
};

function toDto(view: AdminSavedViewRecord): AdminSavedViewDto {
  return {
    id: view.id,
    listKey: view.listKey as AdminSavedViewListKey,
    label: view.label,
    query: view.query,
    position: view.position,
  };
}

/**
 * A staff member's own saved table views. Everything is scoped to the signed-in person; the
 * repository never receives anyone else's subject id.
 */
export class AdminSavedViewService {
  constructor(private readonly repository: IAdminSavedViewRepository) {}

  private canUse(actor: SavedViewActor, listKey: AdminSavedViewListKey): boolean {
    return userHasAccessTo(
      actor.role as UserRole,
      normalizeUserStaffRole(actor.staffRole),
      LIST_ACCESS[listKey],
    );
  }

  async list(
    actor: SavedViewActor,
    listKey: AdminSavedViewListKey,
  ): Promise<Result<AdminSavedViewDto[], SavedViewError>> {
    if (!this.canUse(actor, listKey)) return err({ status: 403, message: "Forbidden" });
    const views = await this.repository.list(actor.userId, listKey);
    return ok(views.map(toDto));
  }

  async create(
    actor: SavedViewActor,
    input: { listKey: AdminSavedViewListKey; label: string; query: string },
  ): Promise<Result<AdminSavedViewDto, SavedViewError>> {
    if (!this.canUse(actor, input.listKey)) return err({ status: 403, message: "Forbidden" });
    const result = await this.repository.create({
      ownerSubjectId: actor.userId,
      ...input,
      maxPerList: ADMIN_SAVED_VIEWS_PER_LIST_MAX,
    });
    if (result.status === "created") return ok(toDto(result.view));
    if (result.status === "limit_reached") {
      return err({
        status: 409,
        code: "limit_reached",
        message: `You can keep up to ${ADMIN_SAVED_VIEWS_PER_LIST_MAX} views for a list. Delete one to save another.`,
      });
    }
    return err({
      status: 409,
      code: "duplicate_label",
      message: "You already have a view with that name.",
    });
  }

  async rename(
    actor: SavedViewActor,
    id: string,
    label: string,
  ): Promise<Result<AdminSavedViewDto, SavedViewError>> {
    const result = await this.repository.rename(actor.userId, id, label);
    if (result.status === "renamed") return ok(toDto(result.view));
    if (result.status === "not_found") return err({ status: 404, message: "View not found" });
    return err({
      status: 409,
      code: "duplicate_label",
      message: "You already have a view with that name.",
    });
  }

  async reorder(
    actor: SavedViewActor,
    listKey: AdminSavedViewListKey,
    ids: readonly string[],
  ): Promise<Result<AdminSavedViewDto[], SavedViewError>> {
    if (!this.canUse(actor, listKey)) return err({ status: 403, message: "Forbidden" });
    const result = await this.repository.reorder(actor.userId, listKey, ids);
    if (result.status === "reordered") return ok(result.views.map(toDto));
    return err({
      status: 409,
      code: "order_changed",
      message: "Your views changed on another device. Reload to see them.",
    });
  }

  async remove(actor: SavedViewActor, id: string): Promise<Result<void, SavedViewError>> {
    const removed = await this.repository.remove(actor.userId, id);
    return removed ? ok(undefined) : err({ status: 404, message: "View not found" });
  }
}
