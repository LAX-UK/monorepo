export const POISON_EVENT_THRESHOLD = 5;

export type StuckEventMeta = {
  eventId: number;
  failures: number;
  lastMessage: string;
};

export function parseStuckMeta(lastError: string | null): StuckEventMeta | null {
  if (!lastError) return null;
  try {
    const parsed = JSON.parse(lastError) as Partial<StuckEventMeta>;
    if (
      typeof parsed.eventId === "number" &&
      typeof parsed.failures === "number" &&
      typeof parsed.lastMessage === "string"
    ) {
      return {
        eventId: parsed.eventId,
        failures: parsed.failures,
        lastMessage: parsed.lastMessage,
      };
    }
  } catch {
    /* legacy plain-text last_error */
  }
  return null;
}

export type ProjectorFailureOutcome =
  | { action: "retry"; failures: number }
  | { action: "skip"; failures: number; message: string };
