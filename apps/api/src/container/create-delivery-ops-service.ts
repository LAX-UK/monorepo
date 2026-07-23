import type { Database } from "@auction/db";
import { DrizzleDomainEventDeliveryRepository } from "@auction/persistence/repositories";
import {
  DeliveryOpsApplicationService,
  type DeliveryOpsApplicationService as DeliveryOpsApplicationServiceType,
} from "../services/delivery-ops.application.service.js";

export function createDeliveryOpsService(db: Database): DeliveryOpsApplicationServiceType {
  return new DeliveryOpsApplicationService(new DrizzleDomainEventDeliveryRepository(db), db);
}
