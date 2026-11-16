/**
 * The producer the demo seeds write on the domain events they record (GAP-31). It is the explicit
 * mark that an event describes invented demo data: projectors that send email (finance alerts,
 * collection notices) skip such events, so seeding test never mails staff or invented addresses.
 * Everything else about the event is what the real recorder writes, so staff screens and
 * timelines read it as usual. Nothing but the demo seeds may use it.
 */
export const DEMO_SEED_EVENT_PRODUCER = "demo-seed";

/** Whether an event was written by the demo seeds, so no notification may follow from it. */
export function isDemoSeedEvent(event: { producer?: string | null }): boolean {
  return event.producer === DEMO_SEED_EVENT_PRODUCER;
}
