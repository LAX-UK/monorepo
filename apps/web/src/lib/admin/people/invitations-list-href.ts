import { buildListHref } from "@/lib/admin/admin-list-params";
import { readSearchParamsRecord } from "@/lib/admin/legal-entities-list-href";
import { INVITATIONS_LIST_PATH } from "@/lib/admin/people/build-invitations-list-page-model";

type SearchParamsLike = {
  forEach(callback: (value: string, key: string) => void): void;
};

export function buildInvitationsDrawerHref(
  searchParams: SearchParamsLike,
  invitationId: string | null,
): string {
  return buildListHref(
    INVITATIONS_LIST_PATH,
    readSearchParamsRecord(searchParams),
    invitationId ? { invitation: invitationId } : { invitation: "" },
  );
}
