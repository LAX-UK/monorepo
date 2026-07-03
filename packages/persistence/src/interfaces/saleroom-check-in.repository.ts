import type { LegalEntityKind, LegalEntityMemberRole } from "@auction/types";

export type CheckInCandidateEntity = {
  id: string;
  displayName: string;
  role: LegalEntityMemberRole;
  kind: LegalEntityKind;
  existingRegistration: {
    status: string;
    paddleNumber: number | null;
    bidLimit: string | null;
    checkedInAt: Date | null;
  } | null;
};

export type CheckInCandidateRow = {
  userId: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  kycStatus: string;
  suspended: boolean;
  eligibleEntities: CheckInCandidateEntity[];
};

export type CheckInWithPaddleInput = {
  saleId: string;
  userId: string;
  buyerLegalEntityId: string;
  decidedByUserId: string;
  /** When false, mark present without assigning a paddle (hybrid website-first). */
  assignPaddle: boolean;
  /** Omit to preserve an existing limit on re-check-in. */
  bidLimit?: string | null;
  /** Omit to preserve existing notes on re-check-in. */
  laxNotes?: string | null;
  /** Explicit paddle from staff; null = keep existing or auto-assign next free when assignPaddle. */
  requestedPaddleNumber: number | null;
};

export type CheckInWithPaddleResult = {
  registrationId: string;
  paddleNumber: number | null;
  checkedInAt: Date;
};

/** Thrown by {@link DrizzleSaleroomCheckInRepository.checkInWithPaddle} when the requested
 * (or auto-assigned) paddle collides with another registration in the same sale. */
export class PaddleTakenError extends Error {
  readonly code = "paddle_taken" as const;
  constructor() {
    super("Paddle number is already assigned in this sale");
    this.name = "PaddleTakenError";
  }
}

export interface ISaleroomCheckInRepository {
  searchCandidates(saleId: string, q: string, limit?: number): Promise<CheckInCandidateRow[]>;
  /** Atomically upsert an approved (staff check-in) registration and assign a paddle in a single
   * transaction. Rolls back entirely on paddle conflict so staff never get a partial state. */
  checkInWithPaddle(input: CheckInWithPaddleInput): Promise<CheckInWithPaddleResult>;
}
