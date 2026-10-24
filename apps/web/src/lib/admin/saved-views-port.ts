import {
  adminCreateSavedViewAction,
  adminDeleteSavedViewAction,
  adminListSavedViewsAction,
  adminRenameSavedViewAction,
  adminReorderSavedViewsAction,
} from "@/lib/actions/admin/admin-saved-views";
import type { ActionResult } from "@/lib/forms/form-result";
import { type SavedView, SavedViewsError, type SavedViewsPort } from "@auction/staff-ui";
import type { AdminSavedViewListKey } from "@auction/validators";

/** The Bid API's codes for saved views, as the staff kit names them. */
const ERROR_CODES = {
  duplicate_label: "duplicate",
  limit_reached: "limit",
  order_changed: "stale",
} as const;

/** The value of a successful action, or the kit's error for a failed one. */
function unwrap<T>(result: ActionResult<T>): T | undefined {
  if (result.ok) return result.data;
  const code = result.errorCode ? ERROR_CODES[result.errorCode as keyof typeof ERROR_CODES] : null;
  if (code) throw new SavedViewsError(code, result.error);
  if (result.status === 404) throw new SavedViewsError("stale", "That view no longer exists.");
  throw new SavedViewsError("failed", "Something went wrong. Try again.");
}

async function call<T>(run: () => Promise<ActionResult<T>>): Promise<T | undefined> {
  let result: ActionResult<T>;
  try {
    result = await run();
  } catch {
    throw new SavedViewsError("failed", "Could not reach the server. Try again.");
  }
  return unwrap(result);
}

/** One Bid admin list's saved views, stored by the Bid API through server actions. */
export function createSavedViewsPort(listKey: AdminSavedViewListKey): SavedViewsPort {
  return {
    async load() {
      return (await call(() => adminListSavedViewsAction({ listKey }))) ?? [];
    },
    async create({ label, query }) {
      const view = await call(() => adminCreateSavedViewAction({ listKey, label, query }));
      if (!view) throw new SavedViewsError("failed", "Something went wrong. Try again.");
      return view satisfies SavedView;
    },
    async rename(id, label) {
      const view = await call(() => adminRenameSavedViewAction(id, { label }));
      if (!view) throw new SavedViewsError("failed", "Something went wrong. Try again.");
      return view;
    },
    async reorder(ids) {
      await call(() => adminReorderSavedViewsAction({ listKey, ids: [...ids] }));
    },
    async remove(id) {
      await call(() => adminDeleteSavedViewAction(id));
    },
  };
}
