import { validatePaddleNumber } from "@/features/saleroom/lib/bid-entry";

/** Minimal registered paddle row for clerk-side checks (interface segregation). */
export type SaleroomRegisteredPaddle = {
  paddleNumber: number;
  displayName?: string;
};

/** Lookup port — roster source can be static list, poll, or test double. */
export interface SaleroomPaddleRosterLookup<
  T extends SaleroomRegisteredPaddle = SaleroomRegisteredPaddle,
> {
  findByPaddleNumber(paddleNumber: number): T | null;
}

export function createPaddleRosterLookup<T extends SaleroomRegisteredPaddle>(
  roster: readonly T[],
): SaleroomPaddleRosterLookup<T> {
  const byNumber = new Map(roster.map((entry) => [entry.paddleNumber, entry]));
  return {
    findByPaddleNumber(paddleNumber) {
      return byNumber.get(paddleNumber) ?? null;
    },
  };
}

export function validatePaddleRegistration<
  T extends SaleroomRegisteredPaddle = SaleroomRegisteredPaddle,
>(paddleNumber: string, lookup: SaleroomPaddleRosterLookup<T>): string | null {
  const formatError = validatePaddleNumber(paddleNumber);
  if (formatError) return formatError;

  const parsed = Number.parseInt(paddleNumber, 10);
  if (!lookup.findByPaddleNumber(parsed)) {
    return "Paddle not checked in for this sale";
  }
  return null;
}

export type PaddleRegistrationValidator = (paddleNumber: string) => string | null;

export function createPaddleRegistrationValidator<
  T extends SaleroomRegisteredPaddle = SaleroomRegisteredPaddle,
>(roster: readonly T[]): PaddleRegistrationValidator {
  const lookup = createPaddleRosterLookup(roster);
  return (paddleNumber) => validatePaddleRegistration(paddleNumber, lookup);
}
