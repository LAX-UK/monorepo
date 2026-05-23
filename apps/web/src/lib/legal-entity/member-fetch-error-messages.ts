import { describeLegalEntityAccessMessage } from "@/lib/legal-entity/legal-entity-access-errors";

/** @deprecated Use describeLegalEntityAccessMessage or describeDashboardSliceFailure */
export function describeMemberFetchFailure(status: number, errorCode: string | null): string {
  return describeLegalEntityAccessMessage(status, errorCode);
}
