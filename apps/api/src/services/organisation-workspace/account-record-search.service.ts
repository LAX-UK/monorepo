import {
  type AccountSearchGroup,
  type AccountSearchScopes,
  type AccountSearchTerms,
  accountSearchGroupsFor,
  accountSearchScopes,
  accountSearchTerms,
} from "@auction/domain";
import type {
  AccountSearchCriteria,
  AccountSearchHits,
  IAccountRecordSearchReader,
} from "@auction/persistence/interfaces";
import { ACCOUNT_SEARCH_OVERVIEW_LIMIT, type AccountSearchQuery } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import type {
  AccountSearchError,
  AccountSearchGroupResult,
  AccountSearchResult,
  IAccountRecordSearchService,
} from "../interfaces/account-record-search-service.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";

/** A page of one group when the member pages through it on its own. */
const GROUP_PAGE_DEFAULT = 20;

const NOT_SEARCHABLE: AccountSearchError = {
  code: "insufficient_entity_role",
  status: 403,
  message: "You can't search these records for this account.",
};

type Page = { limit: number; offset: number };

/**
 * A group's reader seen through the union of groups. TypeScript cannot pair a group with its own
 * reader inside one generic call, so the single cast lives here; the domain table guarantees each
 * group is read with its own scope.
 */
type GroupReader = (
  criteria: AccountSearchCriteria<NonNullable<AccountSearchScopes[AccountSearchGroup]>>,
) => Promise<AccountSearchHits[AccountSearchGroup][]>;

/**
 * Searches the acting account. The domain decides which groups the member may search and whose
 * records each reads; the readers apply that scope. Groups are read in parallel, one page each,
 * one row past the page to know whether another follows.
 */
export class AccountRecordSearchService implements IAccountRecordSearchService {
  constructor(private readonly reader: IAccountRecordSearchReader) {}

  async search(
    actor: OrganisationMemberActor,
    query: AccountSearchQuery,
  ): Promise<Result<AccountSearchResult, AccountSearchError>> {
    const scopes = accountSearchScopes(actor);
    const searchable = accountSearchGroupsFor(actor);
    if (query.group && !searchable.includes(query.group)) return err(NOT_SEARCHABLE);

    const terms = accountSearchTerms(query.q);
    if (!terms) return ok({ searchable, groups: [] });

    const page: Page = {
      limit: query.limit ?? (query.group ? GROUP_PAGE_DEFAULT : ACCOUNT_SEARCH_OVERVIEW_LIMIT),
      offset: query.offset,
    };
    const groups = await Promise.all(
      (query.group ? [query.group] : searchable).map((group) =>
        this.searchGroup(group, scopes, actor, terms, page),
      ),
    );
    return ok({ searchable, groups });
  }

  private async searchGroup(
    group: AccountSearchGroup,
    scopes: AccountSearchScopes,
    actor: OrganisationMemberActor,
    terms: AccountSearchTerms,
    page: Page,
  ): Promise<AccountSearchGroupResult> {
    const scope = scopes[group];
    if (!scope) return { group, items: [], nextOffset: null } as AccountSearchGroupResult;
    const read = this.reader[group] as GroupReader;
    const rows = await read({
      legalEntityId: actor.legalEntityId,
      userId: actor.userId,
      scope,
      terms,
      limit: page.limit + 1,
      offset: page.offset,
    });
    return {
      group,
      items: rows.slice(0, page.limit),
      nextOffset: rows.length > page.limit ? page.offset + page.limit : null,
    } as AccountSearchGroupResult;
  }
}
