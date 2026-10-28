import type {
  ConsignmentMoveBody,
  UnsoldLotChoiceDecisionBody,
  UnsoldLotChoiceRequestBody,
} from "@auction/validators";
import type { IAuthedApiClient } from "../http/authed-api-client";
import type { ServiceResult } from "../http/service-result";
import type {
  IAdminConsignmentAfterSaleService,
  IConsignmentAfterSaleService,
} from "../interfaces/consignment-after-sale-service";

const path = (submissionId: string, rest: string) =>
  `/submissions/${encodeURIComponent(submissionId)}/${rest}`;

function postJson(body: unknown) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  } as const;
}

/** Unwraps `{ data }` from a successful response. */
function data<T>(result: ServiceResult<unknown>): ServiceResult<T> {
  if (!result.ok) return result;
  const body = result.data as { data?: T } | null;
  return { ...result, data: (body?.data ?? body) as T };
}

export class ConsignmentAfterSaleService implements IConsignmentAfterSaleService {
  constructor(private readonly api: IAuthedApiClient) {}

  requestUnsoldChoice(submissionId: string, body: UnsoldLotChoiceRequestBody) {
    return this.api.json<unknown>(path(submissionId, "unsold-choice"), postJson(body));
  }

  async withdraw(submissionId: string) {
    return data<{ kind: "withdrawn" | "requested" }>(
      await this.api.json<unknown>(path(submissionId, "withdrawal"), postJson({})),
    );
  }
}

export class AdminConsignmentAfterSaleService implements IAdminConsignmentAfterSaleService {
  constructor(private readonly api: IAuthedApiClient) {}

  decideUnsoldChoice(submissionId: string, body: UnsoldLotChoiceDecisionBody) {
    return this.api.json<unknown>(path(submissionId, "unsold-choice/decision"), {
      ...postJson(body),
      skipActingLegalEntityHeader: true,
    });
  }

  setRelistReserveFloor(submissionId: string, floor: string | null) {
    return this.api.json<unknown>(path(submissionId, "relist-floor"), {
      ...postJson({ floor }),
      skipActingLegalEntityHeader: true,
    });
  }

  move(submissionId: string, body: ConsignmentMoveBody) {
    return this.api.json<unknown>(path(submissionId, "move"), {
      ...postJson(body),
      skipActingLegalEntityHeader: true,
    });
  }

  async remindSeller(submissionId: string) {
    return data<{ sent: boolean; lastSentAt: string | null }>(
      await this.api.json<unknown>(path(submissionId, "identity-reminder"), {
        ...postJson({}),
        skipActingLegalEntityHeader: true,
      }),
    );
  }
}
