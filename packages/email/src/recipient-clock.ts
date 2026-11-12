import { LONDON_TIME_ZONE, cityName, describeMoment, normaliseViewerZone } from "@auction/datetime";
import type { EmailMoment, ZoneNote } from "./templates/types/moment.js";

/**
 * The clock one email is written on: official times in the zone the event is on (London unless
 * the sale has its own), and, for a recipient with a saved Account zone, their own time beneath.
 * Build the email's moments through it, then take `zoneNote` for the footer line, which exists
 * only if some moment got a local time.
 */
export class RecipientClock {
  private readonly viewerZone: string | null;
  private showedLocal = false;

  constructor(
    savedZone: string | null | undefined,
    private readonly now: Date,
    private readonly changeZoneUrl: string,
  ) {
    this.viewerZone = normaliseViewerZone(savedZone);
  }

  /** The moment in `officialZone`, with the recipient's local time under it when it differs. */
  moment(instant: Date, officialZone: string = LONDON_TIME_ZONE): EmailMoment {
    const { official, local } = describeMoment(instant, {
      officialZone,
      viewerZone: this.viewerZone,
      now: this.now,
    });
    if (!local) return { official };
    this.showedLocal = true;
    return { official, local: local.text };
  }

  /** The footer line's variables, or `null` when no local time was shown. */
  get zoneNote(): ZoneNote | null {
    return this.showedLocal && this.viewerZone
      ? { city: cityName(this.viewerZone), changeUrl: this.changeZoneUrl }
      : null;
  }
}
