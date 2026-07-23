import type { IAdminMarketingEventsApplicationService } from "../interfaces/admin-routes/admin-satellite-routes.js";
import type { AdminMarketingEventsService } from "./admin-marketing-events.service.js";

export class AdminMarketingEventsApplicationService
  implements IAdminMarketingEventsApplicationService
{
  constructor(private readonly marketingEvents: AdminMarketingEventsService) {}

  replay(...args: Parameters<AdminMarketingEventsService["replay"]>) {
    return this.marketingEvents.replay(...args);
  }

  stats(...args: Parameters<AdminMarketingEventsService["stats"]>) {
    return this.marketingEvents.stats(...args);
  }
}
