import type { Database } from "@auction/db";
import type { ILegalEntityNotificationRecipientReader } from "@auction/persistence/interfaces";
import { DrizzleAccessRequestRepository } from "@auction/persistence/repositories";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import type { IAccessRequestService } from "../services/interfaces/access-request-service.js";
import type { IMemberManagementService } from "../services/interfaces/member-management.js";
import type { INotificationFactory } from "../services/interfaces/notification-factory.js";
import type { IOrganisationNames } from "../services/interfaces/organisation-names.js";
import type { NotificationDispatcher } from "../services/notification.dispatcher.js";
import {
  AccessRequestNotifier,
  MemberServiceRoleChanger,
} from "../services/organisation-access/access-request-adapters.js";
import { AccessRequestService } from "../services/organisation-access/access-request.service.js";

/** Access requests for the acting organisation. */
export type OrganisationAccessServices = {
  accessRequests: IAccessRequestService;
};

export function createOrganisationAccessServices(input: {
  db: Database;
  memberManagement: Pick<IMemberManagementService, "updateRole">;
  recipients: ILegalEntityNotificationRecipientReader;
  notificationDispatcher: Pick<NotificationDispatcher, "dispatch">;
  notificationFactory: Pick<
    INotificationFactory,
    "createAccessRequested" | "createAccessRequestDecided"
  >;
  events: IDomainEventSink;
  organisations: IOrganisationNames;
}): OrganisationAccessServices {
  const requests = new DrizzleAccessRequestRepository(input.db);
  return {
    accessRequests: new AccessRequestService({
      requests,
      members: requests,
      roles: new MemberServiceRoleChanger(input.memberManagement),
      notifier: new AccessRequestNotifier(
        input.recipients,
        input.notificationDispatcher,
        input.notificationFactory,
        input.organisations,
      ),
      events: input.events,
    }),
  };
}
