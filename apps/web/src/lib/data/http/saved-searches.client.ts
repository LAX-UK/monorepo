import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";

export type SavedSearchRow = {
  id: string;
  label: string;
  query: Record<string, string>;
  notifyEmail: boolean;
  createdAt: string;
};

const jsonHeaders = { "Content-Type": "application/json" } as const;

/** GET /users/me/saved-searches */
export async function fetchSavedSearches(): Promise<
  { ok: true; rows: SavedSearchRow[] } | { ok: false; error: string }
> {
  try {
    const res = await browserFetch(`${browserApiBase()}/users/me/saved-searches`);
    if (!res.ok) {
      return { ok: false, error: "Could not load saved searches. Try again in a moment." };
    }
    const payload = (await res.json()) as { data?: SavedSearchRow[] };
    return { ok: true, rows: Array.isArray(payload.data) ? payload.data : [] };
  } catch {
    return {
      ok: false,
      error: "Could not load saved searches. Check your connection and try again.",
    };
  }
}

/** POST /users/me/saved-searches */
export async function createSavedSearch(input: {
  label: string;
  query: Record<string, string>;
  notifyEmail?: boolean;
}): Promise<{ ok: true } | { ok: false }> {
  try {
    const res = await browserFetch(`${browserApiBase()}/users/me/saved-searches`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({
        label: input.label,
        query: input.query,
        notifyEmail: input.notifyEmail ?? true,
      }),
    });
    return res.ok ? { ok: true } : { ok: false };
  } catch {
    return { ok: false };
  }
}

/** DELETE /users/me/saved-searches/:id */
export async function deleteSavedSearch(id: string): Promise<boolean> {
  try {
    const res = await browserFetch(
      `${browserApiBase()}/users/me/saved-searches/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    return res.ok;
  } catch {
    return false;
  }
}
