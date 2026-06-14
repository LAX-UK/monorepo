import { projectorState } from "@auction/db";
import { captureBackgroundError } from "@auction/observability";
import { eq } from "drizzle-orm";
import type pino from "pino";

type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;

const POISON_EVENT_THRESHOLD = 5;

type StuckEventMeta = {
  eventId: number;
  failures: number;
  lastMessage: string;
};

function parseStuckMeta(lastError: string | null): StuckEventMeta | null {
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

/**
 * Records a projector event failure. After {@link POISON_EVENT_THRESHOLD} attempts on
 * the same event id, returns `skip` so the cursor can advance past a poison message.
 */
export async function recordProjectorEventFailure(args: {
  db: Db;
  log: pino.Logger;
  projectorName: string;
  eventId: number;
  err: unknown;
}): Promise<ProjectorFailureOutcome> {
  const message = args.err instanceof Error ? args.err.message : String(args.err);

  const [row] = await args.db
    .select({ lastError: projectorState.lastError })
    .from(projectorState)
    .where(eq(projectorState.projectorName, args.projectorName))
    .limit(1);

  const prior = parseStuckMeta(row?.lastError ?? null);
  const failures = prior && prior.eventId === args.eventId ? prior.failures + 1 : 1;

  if (failures >= POISON_EVENT_THRESHOLD) {
    const skipMessage = `Skipped poison event ${args.eventId} after ${failures} failures: ${message}`;
    const skipError = args.err instanceof Error ? args.err : new Error(skipMessage);
    args.log.error(
      { projector: args.projectorName, eventId: args.eventId, failures, err: args.err },
      "projector_poison_event_skipped",
    );
    captureBackgroundError("projector", skipError, {
      tags: {
        projector: args.projectorName,
        outcome: "poison_event_skipped",
      },
      extra: {
        eventId: args.eventId,
        failures,
        skipMessage,
      },
    });
    await args.db
      .update(projectorState)
      .set({
        lastError: skipMessage,
        updatedAt: new Date(),
      })
      .where(eq(projectorState.projectorName, args.projectorName));
    return { action: "skip", failures, message: skipMessage };
  }

  const meta: StuckEventMeta = { eventId: args.eventId, failures, lastMessage: message };
  await args.db
    .update(projectorState)
    .set({
      lastError: JSON.stringify(meta),
      updatedAt: new Date(),
    })
    .where(eq(projectorState.projectorName, args.projectorName));

  args.log.error(
    { projector: args.projectorName, eventId: args.eventId, failures, err: args.err },
    "projector_event_failed_will_retry",
  );
  return { action: "retry", failures };
}
