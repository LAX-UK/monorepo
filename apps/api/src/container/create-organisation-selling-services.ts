import type { Database } from "@auction/db";
import { renderConsignmentAgreementPdf } from "@auction/exports/documents";
import {
  DrizzleAgreementDocumentFactsReader,
  DrizzleConsignmentAgreementRepository,
  DrizzlePayoutLinesReader,
  DrizzleRecordPeopleReader,
  DrizzleReturnedWorksReader,
  DrizzleSoldLotsReader,
} from "@auction/persistence/repositories";
import type {
  IAgreementDocumentService,
  IReturnedWorksService,
  ISoldAndPayoutsService,
} from "../services/interfaces/organisation-selling-service.js";
import type { ISubmissionAccessGuard } from "../services/interfaces/submission-routes/submission-access.js";
import { AgreementDocumentService } from "../services/organisation-selling/agreement-document.service.js";
import { ReturnedWorksService } from "../services/organisation-selling/returned-works.service.js";
import { SoldAndPayoutsService } from "../services/organisation-selling/sold-and-payouts.service.js";

/** The client workspace's selling modules for the acting account. */
export type OrganisationSellingServices = {
  soldAndPayouts: ISoldAndPayoutsService;
  returnedWorks: IReturnedWorksService;
  agreementDocument: IAgreementDocumentService;
};

export function createOrganisationSellingServices(input: {
  db: Database;
  /** Who may see which consignment, the same guard every submission endpoint uses. */
  submissionAccess: ISubmissionAccessGuard;
}): OrganisationSellingServices {
  return {
    soldAndPayouts: new SoldAndPayoutsService({
      sold: new DrizzleSoldLotsReader(input.db),
      payouts: new DrizzlePayoutLinesReader(input.db),
    }),
    returnedWorks: new ReturnedWorksService({
      reader: new DrizzleReturnedWorksReader(input.db),
      access: input.submissionAccess,
    }),
    agreementDocument: new AgreementDocumentService({
      facts: new DrizzleAgreementDocumentFactsReader(input.db),
      agreements: new DrizzleConsignmentAgreementRepository(input.db),
      people: new DrizzleRecordPeopleReader(input.db),
      access: input.submissionAccess,
      render: renderConsignmentAgreementPdf,
    }),
  };
}
