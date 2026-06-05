import type { OnsiteEvent, OnsiteEventRsvp } from "@auction/types";

export interface IOnsiteEventNotifier {
  notifySubmitted(
    event: OnsiteEvent,
    rsvp: OnsiteEventRsvp,
    input: { userEmail: string; userName: string },
  ): Promise<void>;
  notifyUpdated(
    event: OnsiteEvent,
    rsvp: OnsiteEventRsvp,
    input: { userEmail: string; userName: string },
  ): Promise<void>;
}
