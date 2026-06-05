import type { OnsiteEvent, OnsiteEventRsvp } from "@auction/types";

export interface IOnsiteEventNotifier {
  notifySubmitted(
    event: OnsiteEvent,
    rsvp: OnsiteEventRsvp,
    input: { userEmail: string; userName: string; passUrl: string },
  ): Promise<void>;
  notifyUpdated(
    event: OnsiteEvent,
    rsvp: OnsiteEventRsvp,
    input: { userEmail: string; userName: string; passUrl: string },
  ): Promise<void>;
  notifyResent(
    event: OnsiteEvent,
    rsvp: OnsiteEventRsvp,
    input: { userEmail: string; userName: string; passUrl: string },
  ): Promise<void>;
}
