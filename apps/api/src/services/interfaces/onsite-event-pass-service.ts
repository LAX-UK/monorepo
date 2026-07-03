import type { OnsiteEventPassView } from "@auction/types";
import type { OnsiteEventCheckInServiceError } from "./onsite-event-service-errors.js";

export interface IOnsiteEventPassService {
  getPassView(
    eventSlug: string,
    plainToken: string,
    apiBaseUrl: string,
  ): Promise<OnsiteEventPassView | OnsiteEventCheckInServiceError>;
  getPassViewByToken(
    plainToken: string,
    apiBaseUrl: string,
  ): Promise<OnsiteEventPassView | OnsiteEventCheckInServiceError>;
  renderPassQrSvg(passUrl: string): Promise<string>;
}
