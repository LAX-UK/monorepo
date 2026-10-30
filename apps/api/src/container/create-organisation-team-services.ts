import type { Database } from "@auction/db";
import {
  DrizzleInvoiceDetailsRepository,
  DrizzleOrganisationActivityReader,
} from "@auction/persistence/repositories";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import type {
  IInvoiceDetailsService,
  IOrganisationActivityService,
} from "../services/interfaces/organisation-team-service.js";
import { InvoiceDetailsService } from "../services/organisation-team/invoice-details.service.js";
import { OrganisationActivityService } from "../services/organisation-team/organisation-activity.service.js";

/** Team and Profile reads and changes for the acting organisation (`container.organisationTeam`). */
export type OrganisationTeamServices = {
  invoiceDetails: IInvoiceDetailsService;
  activity: IOrganisationActivityService;
};

export function createOrganisationTeamServices(input: {
  db: Database;
  events: IDomainEventSink;
}): OrganisationTeamServices {
  return {
    invoiceDetails: new InvoiceDetailsService({
      details: new DrizzleInvoiceDetailsRepository(input.db),
      events: input.events,
    }),
    activity: new OrganisationActivityService({
      activity: new DrizzleOrganisationActivityReader(input.db),
    }),
  };
}
