import type { LegalEntityKind, LegalEntityMemberRole } from "@auction/types";
import { memberEligibleForStaffInRoomCheckIn } from "@auction/validators";
import type { CheckInCandidateEntity } from "../interfaces/saleroom-check-in.repository.js";

export type { CheckInCandidateEntity } from "../interfaces/saleroom-check-in.repository.js";

type MembershipRow = {
  userId: string;
  legalEntityId: string;
  role: string;
  displayName: string;
  kind: string;
  regStatus: string | null;
  regPaddle: number | null;
  regBidLimit: string | null;
  regCheckedInAt: Date | null;
};

export function groupEligibleCheckInEntities(
  membershipRows: MembershipRow[],
): Map<string, CheckInCandidateEntity[]> {
  const entitiesByUser = new Map<string, CheckInCandidateEntity[]>();

  for (const m of membershipRows) {
    const role = m.role as LegalEntityMemberRole;
    const kind = m.kind as LegalEntityKind;
    if (!memberEligibleForStaffInRoomCheckIn(role, kind)) continue;

    const list = entitiesByUser.get(m.userId) ?? [];
    list.push({
      id: m.legalEntityId,
      displayName: m.displayName,
      role,
      kind,
      existingRegistration:
        m.regStatus != null
          ? {
              status: m.regStatus,
              paddleNumber: m.regPaddle,
              bidLimit: m.regBidLimit,
              checkedInAt: m.regCheckedInAt,
            }
          : null,
    });
    entitiesByUser.set(m.userId, list);
  }

  return entitiesByUser;
}
