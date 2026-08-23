import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";

export type CategoryInterestState = {
  categoryIds: string[];
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
};

export class CategoryInterestPreferencesSaveError extends Error {
  constructor(
    readonly stage: "request" | "response" | "parse",
    readonly status: number | null,
    readonly apiCode: string | null,
    cause?: unknown,
  ) {
    super(`Failed to save auction interest preferences during ${stage}`);
    this.name = "CategoryInterestPreferencesSaveError";
    this.cause = cause;
  }
}

export async function getServerCategoryInterests(): Promise<CategoryInterestState> {
  const response = await authedServerFetch("/users/me/category-interests");
  if (!response.ok) throw new Error(`Failed to read category interests: ${response.status}`);
  const body = (await response.json()) as { data: CategoryInterestState };
  return body.data;
}

export async function replaceServerCategoryInterests(
  categoryIds: readonly string[],
): Promise<CategoryInterestState> {
  const response = await authedServerFetch("/users/me/category-interests", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ categoryIds }),
  });
  if (!response.ok) throw new Error(`Failed to save category interests: ${response.status}`);
  const body = (await response.json()) as { data: CategoryInterestState };
  return body.data;
}

export async function replaceServerCategoryInterestPreferences(
  categoryIds: readonly string[],
): Promise<CategoryInterestState> {
  // #region agent log
  fetch("http://127.0.0.1:7685/ingest/8d553a4b-6759-482a-a6f6-871e111fa1a5", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "547289" },
    body: JSON.stringify({
      sessionId: "547289",
      runId: "pre-fix",
      hypothesisId: "H1-H4",
      location: "category-interests.server.ts:request",
      message: "Starting category interest preferences request",
      data: { selectedCount: categoryIds.length },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  let response: Response;
  try {
    response = await authedServerFetch("/users/me/category-interests/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ categoryIds }),
    });
  } catch (error) {
    const details = {
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
    // #region agent log
    fetch("http://127.0.0.1:7685/ingest/8d553a4b-6759-482a-a6f6-871e111fa1a5", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "547289" },
      body: JSON.stringify({
        sessionId: "547289",
        runId: "pre-fix",
        hypothesisId: "H4",
        location: "category-interests.server.ts:request-catch",
        message: "Category interest preferences request threw before a response",
        data: details,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    console.error("[debug:547289] category interest preferences request failed", details);
    throw new CategoryInterestPreferencesSaveError("request", null, null, error);
  }
  // #region agent log
  fetch("http://127.0.0.1:7685/ingest/8d553a4b-6759-482a-a6f6-871e111fa1a5", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "547289" },
    body: JSON.stringify({
      sessionId: "547289",
      runId: "pre-fix",
      hypothesisId: "H1-H3",
      location: "category-interests.server.ts:response",
      message: "Category interest preferences API response received",
      data: { status: response.status, ok: response.ok },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  if (!response.ok) {
    let apiCode: string | null = null;
    try {
      const body = (await response.json()) as { code?: unknown };
      apiCode = typeof body.code === "string" ? body.code : null;
    } catch {}
    throw new CategoryInterestPreferencesSaveError("response", response.status, apiCode);
  }
  try {
    const body = (await response.json()) as { data: CategoryInterestState };
    return body.data;
  } catch (error) {
    const details = {
      status: response.status,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
    // #region agent log
    fetch("http://127.0.0.1:7685/ingest/8d553a4b-6759-482a-a6f6-871e111fa1a5", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "547289" },
      body: JSON.stringify({
        sessionId: "547289",
        runId: "pre-fix",
        hypothesisId: "H5",
        location: "category-interests.server.ts:parse-catch",
        message: "Successful category interest response could not be parsed",
        data: details,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    console.error("[debug:547289] category interest preferences response parse failed", details);
    throw new CategoryInterestPreferencesSaveError("parse", response.status, null, error);
  }
}
