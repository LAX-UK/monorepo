import {
  type ApiErrorBody,
  normalizeApiErrorMessage,
  parseApiErrorCodeFromBody,
} from "./api-error-body.js";
import { API_BASE, resolveEventSlug } from "./config.js";
import { RsvpApiError } from "./rsvp-api-error.js";

const RSVP_FETCH_TIMEOUT_MS = 15_000;

export type SegmentOption = {
  value: string;
  label: string;
  helper?: string;
};

export type OnsiteEventPublicConfig = {
  slug: string;
  title: string;
  segmentOptions: SegmentOption[];
  rsvpOpen: boolean;
  rsvpCloseAt: string | null;
  micrositeUrl: string | null;
  startsAt: string | null;
  venue: string | null;
  dressCode: string | null;
  arrivalNote: string | null;
  opsEmail: string | null;
  saleId: string | null;
  linkedSaleTitle: string | null;
  status: "published" | "closed";
};

export type OnsiteEventPublicListItem = {
  slug: string;
  title: string;
  startsAt: string | null;
  venue: string | null;
  dressCode: string | null;
  micrositeUrl: string | null;
  deliveryMode: "onsite" | "hybrid" | null;
};

export type OnsiteEventEmailLookup =
  | { status: "event_closed" }
  | { status: "not_registered" }
  | { status: "suspended" }
  | {
      status: "ready";
      user: { name: string; email: string };
      segmentOptions: SegmentOption[];
      existingRsvp?: {
        attendanceSegment: string;
        plusOne: number;
        plusOneGuestName: string | null;
        notes: string | null;
        updatedAt: string;
      };
    };

export type SubmitRsvpInput = {
  email: string;
  attendanceSegment: string;
  plusOne: number;
  plusOneGuestName?: string;
  notes?: string;
};

export type SubmitRsvpResult = {
  id: string;
  attendanceSegment: string;
  plusOne: number;
  plusOneGuestName: string | null;
  notes: string | null;
  isUpdate: boolean;
  passUrl: string;
};

function requireEventSlug(): string {
  const slug = resolveEventSlug();
  if (!slug) {
    throw new RsvpApiError("event_slug_required", "Open a specific event invitation to RSVP.");
  }
  return slug;
}

async function parseJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`invalid_json_${res.status}`);
  }
}

function throwApiError(res: Response, body: ApiErrorBody | undefined, prefix: string): never {
  if (res.status === 429) {
    throw new RsvpApiError("rate_limited");
  }
  const code = parseApiErrorCodeFromBody(body ?? {}) ?? `${prefix}_${res.status}`;
  const message =
    code === "validation_failed"
      ? normalizeApiErrorMessage(body?.error, "Please check your RSVP details and try again.")
      : undefined;
  throw new RsvpApiError(code, message);
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(RSVP_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new RsvpApiError("timeout", "This is taking longer than expected. Please try again.");
    }
    throw new RsvpApiError(
      "offline",
      "We couldn't reach the server. Check your connection and try again.",
    );
  }
}

export async function fetchUpcomingEvents(): Promise<OnsiteEventPublicListItem[]> {
  const res = await fetchWithTimeout(`${API_BASE}/events`);
  if (!res.ok) {
    throw new Error(`events_list_failed_${res.status}`);
  }
  const body = await parseJson<{ data: OnsiteEventPublicListItem[] }>(res);
  return body.data;
}

const UPCOMING_EVENTS_RETRY_DELAYS_MS = [0, 600, 1500];

export async function fetchUpcomingEventsWithRetry(): Promise<OnsiteEventPublicListItem[]> {
  let lastError: unknown;
  for (const delay of UPCOMING_EVENTS_RETRY_DELAYS_MS) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    try {
      return await fetchUpcomingEvents();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function fetchEventConfig(): Promise<OnsiteEventPublicConfig> {
  const slug = requireEventSlug();
  const res = await fetchWithTimeout(`${API_BASE}/events/${slug}/config`);
  if (!res.ok) {
    throw new Error(`config_failed_${res.status}`);
  }
  const body = await parseJson<{ data: OnsiteEventPublicConfig }>(res);
  return body.data;
}

const CONFIG_RETRY_DELAYS_MS = [0, 600, 1500];

export async function fetchEventConfigWithRetry(): Promise<OnsiteEventPublicConfig> {
  let lastError: unknown;
  for (const delay of CONFIG_RETRY_DELAYS_MS) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    try {
      return await fetchEventConfig();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function lookupByEmail(email: string): Promise<OnsiteEventEmailLookup> {
  const slug = requireEventSlug();
  const res = await fetchWithTimeout(`${API_BASE}/events/${slug}/lookup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const body = await parseJson<ApiErrorBody>(res).catch(() => undefined);
    throwApiError(res, body, "lookup_failed");
  }
  const body = await parseJson<{ data: OnsiteEventEmailLookup }>(res);
  return body.data;
}

export async function submitRsvp(input: SubmitRsvpInput): Promise<SubmitRsvpResult> {
  const slug = requireEventSlug();
  const res = await fetchWithTimeout(`${API_BASE}/events/${slug}/rsvp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const body = await parseJson<
    {
      data?: SubmitRsvpResult & { attendanceSegment: string; passUrl: string };
      isUpdate?: boolean;
    } & ApiErrorBody
  >(res);
  if (!res.ok) {
    throwApiError(res, body, "submit_failed");
  }
  const data = body.data;
  if (!data) {
    throw new Error("submit_empty_response");
  }
  return {
    id: data.id,
    attendanceSegment: data.attendanceSegment,
    plusOne: data.plusOne,
    plusOneGuestName: data.plusOneGuestName ?? null,
    notes: data.notes,
    isUpdate: body.isUpdate === true,
    passUrl: data.passUrl,
  };
}
