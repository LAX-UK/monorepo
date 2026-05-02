import { domainEvent, projectorState } from "@auction/db";
import { sql } from "drizzle-orm";
import type pino from "pino";

type Db = typeof import("@auction/db").createDb extends (url: string) => infer T ? T : never;
type ProjectorEventRow = {
  id: number;
  event_type: string;
  payload: unknown;
};

function rowsFromExecuteResult(result: unknown): ProjectorEventRow[] {
  if (Array.isArray(result)) return result as ProjectorEventRow[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows?: ProjectorEventRow[] }).rows ?? [];
  }
  return [];
}

export function createProjectorRunner(options: {
  db: Db;
  log: pino.Logger;
  heartbeat: () => Promise<void>;
}) {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;

  async function ensureCursor(projectorName: string) {
    await options.db
      .insert(projectorState)
      .values({ projectorName, lastProcessedEventId: 0 })
      .onConflictDoNothing();
  }

  async function tick() {
    await ensureCursor("zoho");
    await ensureCursor("xero");
    await options.db.transaction(async (tx) => {
      const rows = await tx.execute(sql`
        select id, event_type, payload
        from ${domainEvent}
        where id > (select last_processed_event_id from ${projectorState} where projector_name = 'zoho')
        order by id
        limit 100
        for update skip locked
      `);
      const events = rowsFromExecuteResult(rows);
      for (const event of events) {
        options.log.info(
          { eventId: event.id, eventType: event.event_type },
          "projector observed event",
        );
      }
      const maxId = Math.max(0, ...events.map((event) => Number(event.id)));
      if (maxId > 0) {
        await tx
          .update(projectorState)
          .set({ lastProcessedEventId: maxId, updatedAt: new Date(), lastError: null })
          .where(sql`${projectorState.projectorName} = 'zoho'`);
      }
    });
    await options.heartbeat();
  }

  async function loop() {
    if (stopped) return;
    try {
      await tick();
    } catch (err) {
      options.log.error({ err }, "projector tick failed");
    }
    if (!stopped) timer = setTimeout(loop, 1500);
  }

  return {
    start() {
      void loop();
    },
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
