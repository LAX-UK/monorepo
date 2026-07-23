export function payoutReversalConfirmationPhrase(payoutId: string): string {
  return `REVERSE PAYOUT ${payoutId}`;
}

export function isPayoutReversalConfirmationValid(
  payoutId: string,
  confirmationPhrase: string,
): boolean {
  return confirmationPhrase === payoutReversalConfirmationPhrase(payoutId);
}

export function isPayoutReversalReasonValid(reason: string, minLength = 10): boolean {
  return reason.trim().length >= minLength;
}
