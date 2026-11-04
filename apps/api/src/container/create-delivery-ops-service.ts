import type { Database } from "@auction/db";
import {
  DrizzleDomainEventDeliveryRepository,
  DrizzleIntegrationDeadLetterRepository,
} from "@auction/persistence/repositories";
import {
  DeliveryOpsApplicationService,
  type DeliveryOpsApplicationService as DeliveryOpsApplicationServiceType,
} from "../services/delivery-ops.application.service.js";

export function createDeliveryOpsService(db: Database): DeliveryOpsApplicationServiceType {
  const integrations = new DrizzleIntegrationDeadLetterRepository(db);
  return new DeliveryOpsApplicationService(
    new DrizzleDomainEventDeliveryRepository(db),
    integrations,
    integrations,
  );
}
