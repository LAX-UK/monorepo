import type { Database } from "@auction/db";
import { DrizzleAccountRecordSearchReader } from "@auction/persistence/repositories";
import type { IAccountRecordSearchService } from "../services/interfaces/account-record-search-service.js";
import { AccountRecordSearchService } from "../services/organisation-workspace/account-record-search.service.js";

/** What the client workspace reads across modules for the acting account. */
export type OrganisationWorkspaceServices = {
  search: IAccountRecordSearchService;
};

export function createOrganisationWorkspaceServices(input: {
  db: Database;
}): OrganisationWorkspaceServices {
  return {
    search: new AccountRecordSearchService(new DrizzleAccountRecordSearchReader(input.db)),
  };
}
