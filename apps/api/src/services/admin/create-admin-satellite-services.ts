import type { Database } from "@auction/db";
import { createDeliveryOpsService } from "../../container/create-delivery-ops-service.js";
import type {
  AdminRouteServices,
  AdminRouteServicesWithoutSatellites,
} from "../interfaces/admin-routes.js";
import type { IOnsiteEventAdminService } from "../interfaces/onsite-event-admin-service.js";
import type { IOnsiteEventStaffCheckInService } from "../interfaces/onsite-event-staff-check-in-service.js";
import type { IQueueInspector, IQueueMutator } from "../interfaces/queue-inspector.js";
import { AdminJobQueuesApplicationService } from "./admin-job-queues-application.service.js";
import { AdminMarketingEventsApplicationService } from "./admin-marketing-events-application.service.js";
import type { AdminMarketingEventsService } from "./admin-marketing-events.service.js";
import { AdminOnsiteEventsApplicationService } from "./admin-onsite-events-application.service.js";

export type AttachAdminSatelliteServicesInput = {
  db: Database;
  queueInspector: IQueueInspector;
  queueMutator: IQueueMutator;
  adminMarketingEventsService: AdminMarketingEventsService;
  onsiteEventAdminService: IOnsiteEventAdminService;
  onsiteEventStaffCheckInService: IOnsiteEventStaffCheckInService;
};

export function attachAdminSatelliteServices(
  admin: AdminRouteServicesWithoutSatellites,
  input: AttachAdminSatelliteServicesInput,
): AdminRouteServices {
  return {
    ...admin,
    jobQueues: new AdminJobQueuesApplicationService(input.queueInspector, input.queueMutator),
    marketingEvents: new AdminMarketingEventsApplicationService(input.adminMarketingEventsService),
    onsiteEvents: new AdminOnsiteEventsApplicationService(
      input.onsiteEventAdminService,
      input.onsiteEventStaffCheckInService,
    ),
    deliveryOps: createDeliveryOpsService(input.db),
  };
}
