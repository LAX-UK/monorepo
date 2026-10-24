import { type SavedView, SavedViewsError, type SavedViewsPort } from "@auction/staff-ui";
import { readCookie } from "./read-cookie";
import { SHOP_ADMIN_CSRF_COOKIE } from "./session-cookie";

const SAVED_VIEWS_BASE_PATH = "/api/admin/saved-views";

/** shop-api's error codes for saved views, as the staff kit names them. */
const ERROR_CODES: Record<string, ConstructorParameters<typeof SavedViewsError>[0]> = {
  "shop.saved_view_duplicate": "duplicate",
  "shop.saved_view_limit": "limit",
  "shop.saved_view_order_changed": "stale",
};

type ServerView = { id: string; label: string; query: string };

const toView = ({ id, label, query }: ServerView): SavedView => ({ id, label, query });

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const csrf = readCookie(document.cookie, SHOP_ADMIN_CSRF_COOKIE);
  let response: Response;
  try {
    response = await fetch(`${SAVED_VIEWS_BASE_PATH}${path}`, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        accept: "application/json",
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(init.method && init.method !== "GET" && csrf ? { "x-csrf-token": csrf } : {}),
      },
    });
  } catch {
    throw new SavedViewsError("failed", "Could not reach the server. Try again.");
  }
  if (response.ok) return response;
  let body: { code?: string; message?: string } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    // A body that is not JSON is a plain failure.
  }
  const code = body.code ? ERROR_CODES[body.code] : undefined;
  if (code) throw new SavedViewsError(code, body.message ?? "Something went wrong. Try again.");
  if (response.status === 404) {
    throw new SavedViewsError("stale", "That view no longer exists.");
  }
  throw new SavedViewsError("failed", "Something went wrong. Try again.");
}

const json = (value: unknown) => JSON.stringify(value);

/** One list's saved views, stored through LAX Admin's staff proxy to shop-api. */
export function createSavedViewsPort(listKey: string): SavedViewsPort {
  return {
    async load() {
      const response = await request(`?listKey=${encodeURIComponent(listKey)}`);
      const body = (await response.json()) as { items: ServerView[] };
      return body.items.map(toView);
    },
    async create({ label, query }) {
      const response = await request("", { method: "POST", body: json({ listKey, label, query }) });
      return toView((await response.json()) as ServerView);
    },
    async rename(id, label) {
      const response = await request(`/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: json({ label }),
      });
      return toView((await response.json()) as ServerView);
    },
    async reorder(ids) {
      await request("/order", { method: "PUT", body: json({ listKey, ids }) });
    },
    async remove(id) {
      await request(`/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}
