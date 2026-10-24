import {
  ADMIN_SAVED_VIEWS_PER_LIST_MAX,
  ADMIN_SAVED_VIEW_LABEL_MAX,
  ADMIN_SAVED_VIEW_QUERY_MAX,
  type AdminSavedView,
  type AdminSavedViewListKey,
  SHOP_API_ERROR_CODES,
} from "@auction/shop-contracts";
import {
  type ShopStaffCapability,
  type ShopStaffRole,
  roleHasCapability,
} from "@auction/shop-domain";
import { ShopApiError, notFound } from "../errors/shop-api-error.js";
import type { SavedViewRecord, SavedViewRepository } from "./ports/saved-view.repository.js";

export type SavedViewActor = { subject: string; role: ShopStaffRole };

/**
 * Who may keep views for each list: the people who may open that list. A view is only a saved
 * set of filters, so it grants nothing, but offering to save one on a list a person cannot see
 * would be a dead end.
 */
const LIST_CAPABILITY: Record<AdminSavedViewListKey, ShopStaffCapability> = {
  "lax-admin.orders": "order.read",
  "lax-admin.staff": "settings.write",
};

// biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function toView(record: SavedViewRecord): AdminSavedView {
  return { ...record, listKey: record.listKey as AdminSavedViewListKey };
}

function cleanLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length === 0 || trimmed.length > ADMIN_SAVED_VIEW_LABEL_MAX) {
    throw new ShopApiError(
      SHOP_API_ERROR_CODES.VALIDATION,
      `Name the view in ${ADMIN_SAVED_VIEW_LABEL_MAX} characters or fewer`,
      400,
    );
  }
  return trimmed;
}

function cleanQuery(query: string): string {
  const stripped = query.replace(/^\?/, "");
  if (stripped.length > ADMIN_SAVED_VIEW_QUERY_MAX || CONTROL_CHARACTERS.test(stripped)) {
    throw new ShopApiError(SHOP_API_ERROR_CODES.VALIDATION, "Invalid view query", 400);
  }
  return stripped;
}

const duplicateLabel = () =>
  new ShopApiError(
    SHOP_API_ERROR_CODES.SAVED_VIEW_DUPLICATE,
    "You already have a view with that name.",
    409,
  );

/**
 * A staff member's own saved table views. Everything is scoped to the signed-in person; the
 * repository never receives anyone else's subject id.
 */
export function createSavedViewService(deps: { repository: SavedViewRepository }) {
  const { repository } = deps;

  function requireListAccess(actor: SavedViewActor, listKey: AdminSavedViewListKey): void {
    if (!roleHasCapability(actor.role, LIST_CAPABILITY[listKey])) {
      throw new ShopApiError(SHOP_API_ERROR_CODES.FORBIDDEN, "Insufficient capability", 403);
    }
  }

  return {
    async list(actor: SavedViewActor, listKey: AdminSavedViewListKey) {
      requireListAccess(actor, listKey);
      const views = await repository.list(actor.subject, listKey);
      return { items: views.map(toView) };
    },

    async create(
      actor: SavedViewActor,
      input: { listKey: AdminSavedViewListKey; label: string; query: string },
    ) {
      requireListAccess(actor, input.listKey);
      const outcome = await repository.create({
        ownerSubjectId: actor.subject,
        listKey: input.listKey,
        label: cleanLabel(input.label),
        query: cleanQuery(input.query),
        maxPerList: ADMIN_SAVED_VIEWS_PER_LIST_MAX,
      });
      if (outcome.status === "created") return toView(outcome.view);
      if (outcome.status === "limit_reached") {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.SAVED_VIEW_LIMIT,
          `You can keep up to ${ADMIN_SAVED_VIEWS_PER_LIST_MAX} views for a list. Delete one to save another.`,
          409,
        );
      }
      throw duplicateLabel();
    },

    async rename(actor: SavedViewActor, id: string, label: string) {
      const outcome = await repository.rename(actor.subject, id, cleanLabel(label));
      if (outcome.status === "renamed") return toView(outcome.view);
      if (outcome.status === "not_found") throw notFound("View not found");
      throw duplicateLabel();
    },

    async reorder(actor: SavedViewActor, listKey: AdminSavedViewListKey, ids: readonly string[]) {
      requireListAccess(actor, listKey);
      const outcome = await repository.reorder(actor.subject, listKey, ids);
      if (outcome.status === "reordered") return { items: outcome.views.map(toView) };
      throw new ShopApiError(
        SHOP_API_ERROR_CODES.SAVED_VIEW_ORDER_CHANGED,
        "Your views changed on another device. Reload to see them.",
        409,
      );
    },

    async remove(actor: SavedViewActor, id: string) {
      if (!(await repository.remove(actor.subject, id))) throw notFound("View not found");
    },
  };
}

export type SavedViewService = ReturnType<typeof createSavedViewService>;
