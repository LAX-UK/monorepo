import { API_BASE, EVENT_SLUG } from "./config.js";

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

type ApiError = { error: string; code?: string };

async function parseJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`invalid_json_${res.status}`);
  }
}

function apiErrorCode(res: Response, body: ApiError | undefined, prefix: string): string {
  if (res.status === 429) return "rate_limited";
  return body?.code ?? body?.error ?? `${prefix}_${res.status}`;
}

export async function fetchEventConfig(): Promise<OnsiteEventPublicConfig> {
  const res = await fetch(`${API_BASE}/events/${EVENT_SLUG}/config`);
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
  const res = await fetch(`${API_BASE}/events/${EVENT_SLUG}/lookup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const body = await parseJson<ApiError>(res).catch(() => undefined);
    throw new Error(apiErrorCode(res, body, "lookup_failed"));
  }
  const body = await parseJson<{ data: OnsiteEventEmailLookup }>(res);
  return body.data;
}

export async function submitRsvp(input: SubmitRsvpInput): Promise<SubmitRsvpResult> {
  const res = await fetch(`${API_BASE}/events/${EVENT_SLUG}/rsvp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const body = await parseJson<{
    data?: SubmitRsvpResult & { attendanceSegment: string; passUrl: string };
    isUpdate?: boolean;
    error?: string;
    code?: string;
  }>(res);
  if (!res.ok) {
    const err = body as ApiError;
    throw new Error(apiErrorCode(res, err, "submit_failed"));
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
